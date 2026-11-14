import { z } from 'zod';
import {
  FalModelId,
  illustrationPrompt,
  isFalMediaUrl,
  kindOf,
  mediaLimits,
  sniffMedia,
  type MediaKind,
  type MediaType,
} from '../shared/media';

export type FalConfig = { key: string; imageModel: string; videoModel: string };
export type FalProgress = { phase: 'queued' | 'running'; queuePosition: number | null };
export type FalOutput = {
  bytes: Uint8Array;
  contentType: MediaType;
  width: number | null;
  height: number | null;
  requestId: string;
  model: string;
  prompt: string;
};
const QUEUE = 'https://queue.fal.run';
const Submitted = z.object({
  request_id: z.string().min(1).max(120),
  status_url: z.string().optional(),
  response_url: z.string().optional(),
  cancel_url: z.string().optional(),
  queue_position: z.number().int().nullable().optional(),
});
const Status = z.object({
  status: z.enum(['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED']),
  queue_position: z.number().int().nullable().optional(),
  error: z.string().nullable().optional(),
  error_type: z.string().nullable().optional(),
});
const File = z.object({
  url: z.string(),
  content_type: z.string().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
});
const Output = z.object({
  images: z.array(File).optional(),
  image: File.optional(),
  video: File.optional(),
  has_nsfw_concepts: z.array(z.boolean()).optional(),
});
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    // An already-aborted signal never fires 'abort' again.
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
export class FalError extends Error {}

/** Main-process fal queue client. The key never leaves this process. */
export class FalClient {
  constructor(
    readonly config: FalConfig,
    private request: typeof fetch = (...args) => fetch(...args),
    private pollMs = 1000,
  ) {}
  model(kind: MediaKind) {
    const id = kind === 'image' ? this.config.imageModel : this.config.videoModel;
    return FalModelId.safeParse(id).success ? id : '';
  }
  status() {
    const ready = !!this.config.key;
    return {
      image: ready && !!this.model('image'),
      video: ready && !!this.model('video'),
      imageModel: this.model('image'),
      videoModel: this.model('video'),
    };
  }
  /** Queue URLs must stay on fal's queue host under this request's path. */
  private queueUrl(raw: string | undefined, model: string, id: string, suffix: string) {
    const [owner, app] = model.split('/');
    const expected = `/${owner}/${app}/requests/${encodeURIComponent(id)}${suffix}`;
    if (raw) {
      try {
        const url = new URL(raw);
        if (
          url.protocol === 'https:' &&
          url.hostname === 'queue.fal.run' &&
          !url.username &&
          !url.password &&
          !url.port &&
          url.pathname.startsWith(`/${owner}/`) &&
          url.pathname.endsWith(`/requests/${encodeURIComponent(id)}${suffix}`)
        )
          return url.origin + url.pathname;
      } catch {
        /* fall through to the documented shape */
      }
    }
    return QUEUE + expected;
  }
  private async call(url: string, init: RequestInit, signal: AbortSignal, what: string) {
    let response: Response;
    try {
      response = await this.request(url, {
        ...init,
        redirect: 'error',
        headers: {
          Authorization: `Key ${this.config.key}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
        signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
      });
    } catch (e) {
      if (signal.aborted) throw e;
      throw new FalError(`Could not reach fal while ${what}. Check your connection and retry.`);
    }
    if (response.status === 401 || response.status === 403)
      throw new FalError('fal rejected FAL_KEY. Check the key in .env, then restart yoteach.');
    if (response.status === 402)
      throw new FalError('fal reports no available credit. Add credit to your fal account.');
    if (response.status === 404)
      throw new FalError(
        'fal could not find the configured model or request. Check FAL_IMAGE_MODEL and FAL_VIDEO_MODEL.',
      );
    if (response.status === 422)
      throw new FalError('fal could not accept this request. Try a simpler description.');
    if (response.status === 429)
      throw new FalError('fal is rate limiting requests. Wait a moment and retry.');
    if (!response.ok)
      throw new FalError(`fal failed while ${what} (${response.status}). Try again shortly.`);
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new FalError(`fal returned an unreadable response while ${what}.`);
    }
  }
  private async cancel(url: string) {
    try {
      await this.request(url, {
        method: 'PUT',
        redirect: 'error',
        headers: { Authorization: `Key ${this.config.key}` },
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      /* Best effort. The local result is already discarded. */
    }
  }
  /** Bounded download from fal's CDN, without credentials, verified by content. */
  private async download(raw: string, kind: MediaKind, signal: AbortSignal) {
    if (!isFalMediaUrl(raw)) throw new FalError('fal returned media from an unexpected address.');
    const limit = mediaLimits[kind].bytes;
    let response: Response;
    try {
      response = await this.request(raw, {
        redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(mediaLimits[kind].timeoutMs)]),
      });
    } catch (e) {
      if (signal.aborted) throw e;
      throw new FalError('The generated media could not be downloaded. Try again.');
    }
    if (!response.ok || !response.body)
      throw new FalError(`The generated media could not be downloaded (${response.status}).`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > limit) throw new FalError('The generated media is larger than yoteach allows.');
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > limit) {
          await reader.cancel();
          throw new FalError('The generated media is larger than yoteach allows.');
        }
        chunks.push(value);
      }
    } catch (e) {
      if (e instanceof FalError || signal.aborted) throw e;
      throw new FalError('The generated media download was interrupted. Try again.');
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
    const type = sniffMedia(bytes);
    if (!type || kindOf(type) !== kind)
      throw new FalError(`fal returned a file that is not a supported ${kind}.`);
    return { bytes, type };
  }
  async generate(
    kind: MediaKind,
    subject: string,
    signal: AbortSignal,
    progress: (p: FalProgress) => void = () => {},
  ): Promise<FalOutput> {
    if (!this.config.key)
      throw new FalError('Add FAL_KEY to .env, then restart yoteach to generate illustrations.');
    const model = this.model(kind);
    if (!model)
      throw new FalError(
        kind === 'video'
          ? 'Video generation is off. Set FAL_VIDEO_MODEL in .env to a fal text-to-video model.'
          : 'Set FAL_IMAGE_MODEL in .env to a fal text-to-image model.',
      );
    const prompt = illustrationPrompt(kind, subject);
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(mediaLimits[kind].timeoutMs)]);
    const input =
      kind === 'image'
        ? { prompt, image_size: 'landscape_4_3', num_images: 1, enable_safety_checker: true }
        : { prompt };
    const submitted = Submitted.safeParse(
      await this.call(
        `${QUEUE}/${model}`,
        { method: 'POST', body: JSON.stringify(input) },
        deadline,
        'starting the request',
      ),
    );
    if (!submitted.success) throw new FalError('fal did not return a request ID.');
    const id = submitted.data.request_id;
    const statusUrl = this.queueUrl(submitted.data.status_url, model, id, '/status'),
      resultUrl = this.queueUrl(submitted.data.response_url, model, id, ''),
      cancelUrl = this.queueUrl(submitted.data.cancel_url, model, id, '/cancel');
    progress({ phase: 'queued', queuePosition: submitted.data.queue_position ?? null });
    try {
      for (let delay = this.pollMs; ; delay = Math.min(delay * 1.5, this.pollMs * 4)) {
        await wait(delay, deadline);
        const parsed = Status.safeParse(
          await this.call(statusUrl, { method: 'GET' }, deadline, 'checking progress'),
        );
        if (!parsed.success) throw new FalError('fal returned an unknown request status.');
        const s = parsed.data;
        if (s.status === 'IN_QUEUE')
          progress({ phase: 'queued', queuePosition: s.queue_position ?? null });
        else if (s.status === 'IN_PROGRESS') progress({ phase: 'running', queuePosition: null });
        else {
          if (s.error)
            throw new FalError(
              s.error_type === 'content_policy_violation'
                ? 'fal declined this description under its content policy. Try rewording it.'
                : 'fal could not generate this illustration. Try again or reword it.',
            );
          break;
        }
      }
      const output = Output.safeParse(
        await this.call(resultUrl, { method: 'GET' }, deadline, 'collecting the result'),
      );
      if (!output.success) throw new FalError('fal returned a result yoteach cannot read.');
      if (output.data.has_nsfw_concepts?.[0])
        throw new FalError('fal’s safety checker blanked this image. Try rewording it.');
      const file =
        kind === 'image' ? (output.data.images?.[0] ?? output.data.image) : output.data.video;
      if (!file) throw new FalError(`fal returned no ${kind}.`);
      const media = await this.download(file.url, kind, deadline);
      return {
        bytes: media.bytes,
        contentType: media.type,
        width: file.width ?? null,
        height: file.height ?? null,
        requestId: id,
        model,
        prompt,
      };
    } catch (e) {
      if (signal.aborted) {
        await this.cancel(cancelUrl);
        throw new FalError('Generation cancelled.');
      }
      if (deadline.aborted) {
        await this.cancel(cancelUrl);
        throw new FalError('fal took too long. The request was cancelled; try again.');
      }
      throw e;
    }
  }
}
