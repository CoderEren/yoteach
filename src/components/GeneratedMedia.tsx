import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { GeneratedMedia } from '../../shared/media';
import { api, unwrap } from '../api';
import { useTutor } from '../tutor';

/** Loads saved bytes over IPC into a blob URL; nothing is fetched by the renderer. */
export function MediaView({ media }: { media: GeneratedMedia }) {
  const video = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true,
      made = '';
    setUrl('');
    setStep(0);
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
          <video
            ref={video}
            src={url}
            controls
            muted
            playsInline
            aria-label={alt}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (Number.isFinite(v.duration) && v.duration > 0)
                setStep(Math.min(2, Math.floor((v.currentTime / v.duration) * 3)));
            }}
          />
        )}
      </div>
      {media.kind === 'video' && media.lesson && (
        <div className="video-lesson">
          <strong>{media.lesson.objective}</strong>
          <p className="video-lesson-caption">
            {step + 1}/3 · {media.lesson.steps[step].caption}
          </p>
          <details>
            <summary>Explanation steps</summary>
            <ol>
              {media.lesson.steps.map((beat, i) => (
                <li key={i}>
                  <button
                    className="text-button"
                    onClick={() => {
                      const v = video.current;
                      if (v && Number.isFinite(v.duration)) {
                        v.currentTime = (v.duration * i) / 3;
                        setStep(i);
                      }
                    }}
                  >
                    {beat.caption}
                  </button>
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
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
/** Status and result of the image or clip Yoyo is generating with fal. */
export function GenerationPanel({ media }: { media: GeneratedMedia[] }) {
  const { runtime: r } = useTutor();
  const g = r?.generation ?? null,
    busy = !!g && (g.phase === 'queued' || g.phase === 'running' || g.phase === 'saving');
  const shown = g?.mediaId ? media.find((m) => m.id === g.mediaId) : undefined;
  if (!g) return null;
  return (
    <section className="generation-panel" aria-label="Generated image or clip">
      {busy && (
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
      {(g.phase === 'failed' || g.phase === 'cancelled') && (
        <div className="banner error" role="alert">
          {g.error}
          <button className="text-button" onClick={() => void api.media.dismiss()}>
            Dismiss
          </button>
        </div>
      )}
      {shown && <MediaView media={shown} />}
      {g.phase === 'done' && (
        <button className="text-button" onClick={() => void api.media.dismiss()}>
          <X size={14} /> Close
        </button>
      )}
    </section>
  );
}
