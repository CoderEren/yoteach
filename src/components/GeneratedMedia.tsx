import { useEffect, useState } from 'react';
import { Clapperboard, ImagePlus, RotateCcw, Trash2, X } from 'lucide-react';
import type { GeneratedMedia } from '../../shared/media';
import { api, unwrap } from '../api';
import { useTutor } from '../tutor';

/** Loads saved bytes over IPC into a blob URL; nothing is fetched by the renderer. */
export function MediaView({ media }: { media: GeneratedMedia }) {
  const [url, setUrl] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true,
      made = '';
    setUrl('');
    setError('');
    unwrap(api.media.read(media.id))
      .then(({ bytes, contentType }) => {
        if (!live) return;
        made = URL.createObjectURL(new Blob([bytes as BlobPart], { type: contentType }));
        setUrl(made);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [media.id]);
  const what = media.kind === 'video' ? 'clip' : 'image';
  const alt = `AI-generated ${what}: ${media.subject}`;
  return (
    <figure className="generated-media">
      <div
        className="generated-media-frame"
        style={
          media.width && media.height ? { aspectRatio: `${media.width} / ${media.height}` } : {}
        }
      >
        {error ? (
          <p role="alert">{error}</p>
        ) : !url ? (
          <p role="status">Opening saved {media.kind}…</p>
        ) : media.kind === 'image' ? (
          <img src={url} alt={alt} />
        ) : (
          <video src={url} controls loop muted playsInline aria-label={alt} />
        )}
      </div>
      <figcaption>
        <strong>AI-generated {what}</strong> · illustrative, not a precise diagram · fal{' '}
        <code>{media.model}</code>
      </figcaption>
    </figure>
  );
}
const phaseText = {
  queued: 'Waiting in fal’s queue',
  running: 'Generating',
  saving: 'Saving on this Mac',
} as const;
/**
 * Status and result for fal generation. With a subject, offers student-initiated generation;
 * otherwise shows only what the tutor started.
 */
export function GenerationPanel({
  media,
  subject,
  lessonId,
  lessonStep,
}: {
  media: GeneratedMedia[];
  subject?: string;
  lessonId?: string;
  lessonStep?: number;
}) {
  const { runtime: r } = useTutor();
  const [error, setError] = useState('');
  const g = r?.generation ?? null,
    busy = !!g && (g.phase === 'queued' || g.phase === 'running' || g.phase === 'saving');
  const here = (m: GeneratedMedia) =>
    lessonId ? m.lessonId === lessonId && m.lessonStep === lessonStep : false;
  const fromJob = g?.mediaId ? media.find((m) => m.id === g.mediaId) : undefined;
  const shown =
    fromJob && (!lessonId || here(fromJob))
      ? fromJob
      : lessonId
        ? media.filter(here).at(-1)
        : undefined;
  const relevant = !!g && (!lessonId || (g.lessonId === lessonId && g.lessonStep === lessonStep));
  if (!subject && !relevant) return null;
  async function run(kind: 'image' | 'video') {
    setError('');
    try {
      await unwrap(api.media.generate({ kind, subject: subject! }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  const config = r?.config.media;
  return (
    <section className="generation-panel" aria-label="Generated image or clip">
      {relevant && busy && (
        <div className="generation-status" role="status">
          <span className="generation-pulse" aria-hidden="true" />
          <span>
            {phaseText[g.phase as keyof typeof phaseText]}
            {g.phase === 'queued' && g.queuePosition ? ` · position ${g.queuePosition}` : ''}
            {g.kind === 'video' ? ' · clips can take a few minutes' : ''}…
          </span>
          <button className="text-button" onClick={() => void api.media.cancel()}>
            Cancel
          </button>
        </div>
      )}
      {relevant && (g.phase === 'failed' || g.phase === 'cancelled') && (
        <div className="banner error" role="alert">
          {g.error}
          {subject && g.phase === 'failed' && (
            <button className="text-button" onClick={() => void run(g.kind)}>
              <RotateCcw size={14} /> Retry
            </button>
          )}
          <button className="text-button" onClick={() => void api.media.dismiss()}>
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="banner error" role="alert">
          {error}
          <button className="text-button" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}
      {shown && <MediaView media={shown} />}
      {!subject && relevant && g.phase === 'done' && (
        <button className="text-button" onClick={() => void api.media.dismiss()}>
          <X size={14} /> Close illustration
        </button>
      )}
      {subject && (
        <div className="generation-actions">
          <button
            className="button small"
            disabled={busy || !config?.image}
            onClick={() => void run('image')}
          >
            <ImagePlus size={16} />
            {shown ? 'New visual analogy' : 'Generate visual analogy'}
          </button>
          {config?.video && (
            <button className="button small" disabled={busy} onClick={() => void run('video')}>
              <Clapperboard size={16} />
              Short clip
            </button>
          )}
          {shown && (
            <button
              className="icon-button"
              aria-label="Delete this generated media"
              onClick={() =>
                void unwrap(api.media.remove(shown.id)).catch((e) => setError(String(e)))
              }
            >
              <Trash2 size={16} />
            </button>
          )}
          {!config?.image && (
            <small>Add FAL_KEY to .env and restart to generate illustrations.</small>
          )}
        </div>
      )}
    </section>
  );
}
