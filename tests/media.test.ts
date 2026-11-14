import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../electron/store';
import { Providers } from '../electron/providers';
import { TutorService } from '../electron/tutor';
import { FalClient, videoInput } from '../electron/fal';
import { illustrationPrompt, isFalMediaUrl, sniffMedia } from '../shared/media';
import { ToolSchema } from '../shared/tutor';

const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0xff, 0xd9,
]);
const MP4 = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 2, 0]);
const MODEL = 'fal-ai/flux/schnell';
const ID = 'req-123';
type Call = { url: string; method: string; auth: string | null };
/** Scripted fal queue. Statuses are consumed per poll; the last one repeats. */
function falFake(
  opts: {
    statuses?: object[];
    result?: object;
    media?: Uint8Array | (() => Response);
    submit?: object;
    submitStatus?: number;
    onPoll?: (n: number) => void;
  } = {},
) {
  const calls: Call[] = [];
  let polls = 0;
  const statuses = opts.statuses ?? [
    { status: 'IN_QUEUE', queue_position: 2 },
    { status: 'IN_PROGRESS' },
    { status: 'COMPLETED' },
  ];
  const request: typeof fetch = async (input, init) => {
    const url = String(input),
      method = init?.method ?? 'GET',
      headers = new Headers(init?.headers);
    calls.push({ url, method, auth: headers.get('authorization') });
    if (init?.redirect !== 'error') throw new Error('Redirects must be refused.');
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (method === 'POST' && url === `https://queue.fal.run/${MODEL}`)
      return json(
        opts.submit ?? {
          request_id: ID,
          status_url: `https://queue.fal.run/fal-ai/flux/requests/${ID}/status`,
          response_url: `https://queue.fal.run/fal-ai/flux/requests/${ID}`,
          cancel_url: `https://queue.fal.run/fal-ai/flux/requests/${ID}/cancel`,
          queue_position: 3,
        },
        opts.submitStatus ?? 200,
      );
    if (url === `https://queue.fal.run/fal-ai/flux/requests/${ID}/status`) {
      opts.onPoll?.(polls);
      return json(statuses[Math.min(polls++, statuses.length - 1)]);
    }
    if (url === `https://queue.fal.run/fal-ai/flux/requests/${ID}/cancel`)
      return json({ status: 'OK' });
    if (url === `https://queue.fal.run/fal-ai/flux/requests/${ID}`)
      return json(
        opts.result ?? {
          images: [
            {
              url: 'https://v3.fal.media/files/x/a.jpg',
              width: 1024,
              height: 768,
              content_type: 'image/jpeg',
            },
          ],
          has_nsfw_concepts: [false],
        },
      );
    if (url.startsWith('https://v3.fal.media/'))
      return typeof opts.media === 'function'
        ? opts.media()
        : new Response((opts.media ?? JPEG) as BodyInit, {
            headers: { 'content-type': 'image/jpeg' },
          });
    return new Response('unexpected ' + url, { status: 500 });
  };
  return { request, calls };
}
const client = (request: typeof fetch, video = '') =>
  new FalClient({ key: 'fal-test-key', imageModel: MODEL, videoModel: video }, request, 1);

test('media helpers sniff real bytes, allow only fal CDN URLs and keep prompts text-free', () => {
  assert.equal(sniffMedia(JPEG), 'image/jpeg');
  assert.equal(sniffMedia(MP4), 'video/mp4');
  assert.equal(sniffMedia(new TextEncoder().encode('<!doctype html><html>')), null);
  assert.ok(isFalMediaUrl('https://v3.fal.media/files/a.jpg'));
  assert.ok(isFalMediaUrl('https://fal.media/files/a.jpg'));
  for (const bad of [
    'http://v3.fal.media/a.jpg',
    'https://fal.media.evil.com/a.jpg',
    'https://evilfal.media/a.jpg',
    'https://user:pw@v3.fal.media/a.jpg',
    'https://v3.fal.media:8443/a.jpg',
    'file:///etc/passwd',
  ])
    assert.equal(isFalMediaUrl(bad), false, bad);
  const prompt = illustrationPrompt('image', 'a battery handing an orb to a tile');
  assert.match(prompt, /no text/i);
  assert.match(prompt, /battery handing an orb/);
  assert.throws(() => illustrationPrompt('image', 'x'));
  assert.equal(
    ToolSchema.parse({ name: 'generate_illustration', subject: 'a balance scale' }).name,
    'generate_illustration',
  );
});

test('fal client queues, polls, downloads verified bytes, and never sends the key to the CDN', async () => {
  const fake = falFake(),
    progress: string[] = [];
  const out = await client(fake.request).generate(
    'image',
    'a balance scale with coins',
    new AbortController().signal,
    (p) => progress.push(`${p.phase}:${p.queuePosition}`),
  );
  assert.deepEqual(out.bytes, JPEG);
  assert.equal(out.contentType, 'image/jpeg');
  assert.equal(out.requestId, ID);
  assert.equal(out.width, 1024);
  assert.deepEqual(progress, ['queued:3', 'queued:2', 'running:null']);
  for (const c of fake.calls)
    assert.equal(c.auth, c.url.startsWith('https://queue.fal.run/') ? 'Key fal-test-key' : null);
  const body = fake.calls.find((c) => c.method === 'POST');
  assert.ok(body);
});

test('fal client ignores foreign queue URLs and refuses unexpected or invalid media', async () => {
  const foreign = falFake({
    submit: {
      request_id: ID,
      status_url: 'https://attacker.example/status',
      response_url: 'https://queue.fal.run.attacker.example/x',
    },
  });
  await client(foreign.request).generate('image', 'a scale', new AbortController().signal);
  assert.ok(foreign.calls.every((c) => !c.url.includes('attacker')));

  const offsite = falFake({ result: { images: [{ url: 'https://example.com/a.jpg' }] } });
  await assert.rejects(
    client(offsite.request).generate('image', 'a scale', new AbortController().signal),
    /unexpected address/,
  );
  assert.ok(offsite.calls.every((c) => !c.url.startsWith('https://example.com')));

  const html = falFake({ media: new TextEncoder().encode('<!doctype html><p>not an image</p>') });
  await assert.rejects(
    client(html.request).generate('image', 'a scale', new AbortController().signal),
    /not a supported image/,
  );
  const huge = falFake({
    media: () => new Response(JPEG, { headers: { 'content-length': String(500_000_000) } }),
  });
  await assert.rejects(
    client(huge.request).generate('image', 'a scale', new AbortController().signal),
    /larger than yoteach allows/,
  );
  const nsfw = falFake({
    result: { images: [{ url: 'https://v3.fal.media/a.jpg' }], has_nsfw_concepts: [true] },
  });
  await assert.rejects(
    client(nsfw.request).generate('image', 'a scale', new AbortController().signal),
    /safety checker/,
  );
});

test('fal failures are explained; cancellation and missing configuration are honest', async () => {
  const failed = falFake({ statuses: [{ status: 'COMPLETED', error: 'boom', error_type: 'x' }] });
  await assert.rejects(
    client(failed.request).generate('image', 'a scale', new AbortController().signal),
    /could not generate/,
  );
  assert.ok(!failed.calls.some((c) => c.url.endsWith(`/requests/${ID}`)));
  const rejected = falFake({ submitStatus: 401 });
  await assert.rejects(
    client(rejected.request).generate('image', 'a scale', new AbortController().signal),
    /rejected FAL_KEY/,
  );
  const ctl = new AbortController();
  const slow = falFake({
    statuses: [{ status: 'IN_PROGRESS' }],
    onPoll: (n) => n === 1 && ctl.abort(),
  });
  await assert.rejects(client(slow.request).generate('image', 'a scale', ctl.signal), /cancelled/);
  assert.ok(slow.calls.some((c) => c.method === 'PUT' && c.url.endsWith('/cancel')));
  await assert.rejects(
    new FalClient({ key: '', imageModel: MODEL, videoModel: '' }).generate(
      'image',
      'a scale',
      new AbortController().signal,
    ),
    /Add FAL_KEY/,
  );
  await assert.rejects(
    client(falFake().request).generate('video', 'a scale', new AbortController().signal),
    /FAL_VIDEO_MODEL/,
  );
  assert.deepEqual(client(falFake().request).status(), {
    image: true,
    video: false,
    imageModel: MODEL,
    videoModel: '',
  });
});

function workspace(request: typeof fetch) {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-media-')),
    store = new Store(dir);
  store.importPdf(
    {
      token: randomUUID(),
      courseId: null,
      pages: [{ page: 1 }, { page: 2 }].map((p) => ({ ...p, text: 'Glycolysis' })),
      headings: [],
      organization: 'fallback',
    },
    'Lecture.pdf',
    new Uint8Array(Buffer.from('%PDF-1.7')),
  );
  const service = new TutorService(
    store,
    new Providers(
      { elevenKey: 'k', agentId: 'a', visionKey: 'v', model: 'm' },
      async () => new Response(JSON.stringify({ signed_url: 'wss://api.elevenlabs.io/x' })),
    ),
    () => {},
    () => {},
    client(request),
  );
  return { dir, store, service, doc: store.snapshot().documents[0] };
}

test('generated media is saved atomically with lecture, session and lesson links and survives restart', async () => {
  const w = workspace(falFake().request);
  try {
    const session = await w.service.start(null, 'text', w.doc.id, 2);
    w.service.openLesson();
    w.service.stepLesson(w.service.state.activeLessonId!, 3);
    const started = (await w.service.tool(session.id, {
      name: 'generate_illustration',
      subject: 'a relay baton handed from a battery to a tile',
      kind: 'image',
    })) as { started: boolean; generationId: string };
    assert.equal(started.started, true);
    assert.throws(
      () => w.service.generate({ subject: 'another scene' }, 'student'),
      /already being generated/,
    );
    while (!['done', 'failed'].includes(w.service.state.generation!.phase))
      await new Promise((r) => setTimeout(r, 5));
    const g = w.service.state.generation!;
    assert.equal(g.phase, 'done', g.error);
    const media = w.store.snapshot().media[0];
    assert.equal(media.id, g.mediaId);
    assert.equal(media.origin, 'tutor');
    assert.equal(media.sessionId, session.id);
    assert.equal(media.lessonId, w.service.state.activeLessonId);
    assert.equal(media.lessonStep, 3);
    assert.deepEqual(media.source, { documentId: w.doc.id, page: 2 });
    assert.deepEqual(readdirSync(w.store.mediaDir), [media.filename]);
    assert.deepEqual(w.store.readMedia(media.id).bytes, JPEG);
    // Survives restart, with its file and associations.
    const reopened = new Store(w.dir);
    assert.deepEqual(reopened.snapshot().media, [media]);
    assert.deepEqual(reopened.readMedia(media.id).bytes, JPEG);
    // Deleting the PDF keeps the media but unlinks the missing source.
    reopened.command({ type: 'document.delete', id: w.doc.id });
    assert.equal(reopened.snapshot().media[0].source, null);
    reopened.deleteMedia(media.id);
    assert.deepEqual(readdirSync(reopened.mediaDir), []);
    assert.throws(() => reopened.readMedia(media.id), /no longer exists/);
  } finally {
    rmSync(w.dir, { recursive: true, force: true });
  }
});

test('failed or cancelled generation saves nothing; v4 data migrates with an exact backup', async () => {
  const ctl = { abort: () => {} };
  const w = workspace(
    falFake({ statuses: [{ status: 'IN_PROGRESS' }], onPoll: (n) => n === 2 && ctl.abort() })
      .request,
  );
  try {
    ctl.abort = () => w.service.cancelGeneration();
    w.service.generate({ subject: 'a balance scale' }, 'student');
    assert.throws(() => w.service.dismissGeneration(), /Cancel the generation/);
    while (!['cancelled', 'failed', 'done'].includes(w.service.state.generation!.phase))
      await new Promise((r) => setTimeout(r, 5));
    assert.equal(w.service.state.generation!.phase, 'cancelled');
    assert.deepEqual(w.store.snapshot().media, []);
    w.service.dismissGeneration();
    assert.equal(w.service.state.generation, null);

    const failing = workspace(falFake({ submitStatus: 402 }).request);
    try {
      await failing.service.generate({ subject: 'a balance scale' }, 'student').settled;
      assert.equal(failing.service.state.generation!.phase, 'failed');
      assert.match(failing.service.state.generation!.error, /credit/);
      assert.deepEqual(failing.store.snapshot().media, []);
      assert.deepEqual(readdirSync(failing.store.mediaDir), []);
    } finally {
      rmSync(failing.dir, { recursive: true, force: true });
    }

    const legacy: any = { ...w.store.snapshot(), version: 4 };
    delete legacy.media;
    const bytes = JSON.stringify(legacy);
    writeFileSync(w.store.file, bytes);
    writeFileSync(join(w.store.mediaDir, `${randomUUID()}.jpg`), JPEG);
    writeFileSync(join(w.store.mediaDir, `${randomUUID()}.jpg.tmp`), JPEG);
    writeFileSync(join(w.store.mediaDir, 'keep-me.txt'), 'not owned');
    const migrated = new Store(w.dir);
    assert.equal(migrated.snapshot().version, 7);
    assert.deepEqual(migrated.snapshot().media, []);
    assert.equal(migrated.snapshot().documents[0].id, w.doc.id);
    assert.equal(readFileSync(w.store.file + '.v4.backup', 'utf8'), bytes);
    assert.deepEqual(readdirSync(migrated.mediaDir), ['keep-me.txt']);
    assert.ok(existsSync(w.store.file));
  } finally {
    rmSync(w.dir, { recursive: true, force: true });
  }
});

test('video requests are bounded and silent for LTX 2.3; unknown models get only the prompt', () => {
  assert.deepEqual(videoInput('fal-ai/ltx-2.3/text-to-video/fast', 'p'), {
    prompt: 'p',
    duration: 6,
    resolution: '1080p',
    aspect_ratio: '16:9',
    generate_audio: false,
    enable_safety_checker: true,
  });
  assert.deepEqual(videoInput('fal-ai/some/other-video', 'p'), { prompt: 'p' });
});
