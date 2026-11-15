import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import type { AppState } from '../../shared/model';
import type { Chat } from '../../shared/tutor';
import type { ScreenDrawing } from '../../shared/drawing';
import { api, unwrap } from '../api';
import { DrawingLayer } from './DesktopOverlay';

type Step = { page: number; text: string; at: string };
/**
 * Replays a lecture walkthrough from saved history: each slide with what Yoyo said and drew,
 * advancing on its own. Nothing was recorded; it is rebuilt from the transcript.
 */
export function LectureReplay({
  data,
  chat,
  onClose,
}: {
  data: AppState;
  chat: Chat;
  onClose: () => void;
}) {
  const doc = data.documents.find((d) => d.id === chat.documentId);
  const steps = useMemo<Step[]>(
    () =>
      data.messages
        .filter((m) => m.chatId === chat.id && m.role === 'assistant')
        .map((m) => ({ page: m.page ?? 1, text: m.text, at: m.createdAt })),
    [data.messages, chat.id],
  );
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(true),
    [voice, setVoice] = useState(true),
    [slides, setSlides] = useState<Record<number, { image: string; ratio: number }>>({}),
    [error, setError] = useState('');
  const step = steps[index];
  const bytes = useRef<Uint8Array | null>(null);
  // Render slides on demand, one ahead.
  useEffect(() => {
    if (!doc || !step) return;
    let live = true;
    void (async () => {
      try {
        bytes.current ??= await unwrap(api.readPdf(doc.id));
        const { renderSnapshot } = await import('../pdf');
        for (const page of [step.page, steps[index + 1]?.page].filter(
          (p): p is number => !!p && !slides[p],
        )) {
          const shot = await renderSnapshot(bytes.current, doc, page, 0);
          if (!live) return;
          setSlides((s) => ({
            ...s,
            [page]: { image: shot.image, ratio: shot.width / shot.height },
          }));
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [doc?.id, step?.page, index]);
  // Speak or time each step, then advance.
  useEffect(() => {
    if (!playing || !step) return;
    let done = false;
    const next = () => {
      if (done) return;
      done = true;
      if (index < steps.length - 1) setIndex(index + 1);
      else setPlaying(false);
    };
    if (voice && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(step.text);
      utterance.rate = 1.03;
      utterance.onend = next;
      utterance.onerror = next;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
      return () => {
        done = true;
        speechSynthesis.cancel();
      };
    }
    const words = step.text.split(/\s+/).length;
    const timer = setTimeout(next, Math.min(20000, Math.max(3500, (words / 2.8) * 1000)));
    return () => {
      done = true;
      clearTimeout(timer);
    };
  }, [playing, voice, index, step?.text]);
  useEffect(() => () => speechSynthesis?.cancel(), []);
  const drawing = useMemo<ScreenDrawing | null>(() => {
    if (!step) return null;
    const marks = data.slideDrawings
      .filter(
        (d) =>
          d.chatId === chat.id && d.page === step.page && d.createdAt <= laterThan(steps, index),
      )
      .flatMap((d) => d.marks);
    return marks.length
      ? {
          id: `${chat.id}-${step.page}`,
          snapshotId: null,
          marks: marks.map((m, i) => ({
            id: `${i}`,
            regionId: `${i}`,
            shape: (['highlight', 'circle', 'underline', 'box', 'arrow', 'point'].includes(m.shape)
              ? m.shape
              : 'circle') as ScreenDrawing['marks'][number]['shape'],
            label: m.label,
            box: m.box,
          })),
          connections: [],
          diagram: null,
          sketch: null,
          revision: index,
        }
      : null;
  }, [data.slideDrawings, step?.page, index]);
  const slide = step ? slides[step.page] : undefined;
  if (!doc || !steps.length)
    return (
      <section className="replay">
        <p>This walkthrough has nothing to replay yet.</p>
        <button className="button" onClick={onClose}>
          Back to lectures
        </button>
      </section>
    );
  const go = (i: number) => {
    speechSynthesis?.cancel();
    setIndex(Math.max(0, Math.min(steps.length - 1, i)));
  };
  return (
    <section className="replay" aria-label={`Replay of ${chat.title}`}>
      <header className="replay-header">
        <div>
          <p className="eyebrow">Replay · {new Date(chat.createdAt).toLocaleDateString()}</p>
          <h1>{doc.originalName}</h1>
        </div>
        <button className="icon-button" aria-label="Close replay" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="replay-stage">
        {slide ? (
          <div className="replay-slide" style={{ aspectRatio: `${slide.ratio}` }}>
            <img src={slide.image} alt={`Slide ${step.page}`} />
            <DrawingLayer drawing={drawing} />
          </div>
        ) : (
          <p role="status">{error || `Opening slide ${step.page}…`}</p>
        )}
      </div>
      <p className="replay-caption" aria-live="polite">
        {step.text}
      </p>
      <footer className="replay-controls">
        <button
          className="icon-button"
          aria-label="Previous"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          <ArrowLeft size={17} />
        </button>
        <button
          className="icon-button primary"
          aria-label={playing ? 'Pause replay' : 'Play replay'}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          className="icon-button"
          aria-label="Next"
          disabled={index === steps.length - 1}
          onClick={() => go(index + 1)}
        >
          <ArrowRight size={17} />
        </button>
        <input
          className="replay-progress"
          type="range"
          aria-label="Replay position"
          min={0}
          max={steps.length - 1}
          value={index}
          onChange={(e) => go(Number(e.target.value))}
        />
        <span className="replay-count">
          Slide {step.page} · {index + 1}/{steps.length}
        </span>
        <button
          className="icon-button"
          aria-label={voice ? 'Mute narration' : 'Narrate aloud'}
          onClick={() => {
            speechSynthesis?.cancel();
            setVoice(!voice);
          }}
        >
          {voice ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>
      </footer>
    </section>
  );
}
/** Drawings made before the next thing Yoyo said belong to this step. */
function laterThan(steps: Step[], index: number) {
  return steps[index + 1]?.at ?? '9999';
}
