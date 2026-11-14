import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, Volume2, X } from 'lucide-react';
import { lessonDefinition, type SavedLesson } from '../../shared/lessons';
import { useTutor } from '../tutor';
import { LessonScene } from './LessonScene';
import { HoldButton } from './HoldButton';
import { GenerationPanel } from './GeneratedMedia';
import type { GeneratedMedia } from '../../shared/media';

export function VisualLesson({ saved, media }: { saved: SavedLesson; media: GeneratedMedia[] }) {
  const definition = lessonDefinition(saved.key),
    step = definition.steps[saved.step - 1];
  const { runtime: r, act } = useTutor();
  const [playing, setPlaying] = useState(false),
    [transfer, setTransfer] = useState(0),
    [error, setError] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function go(number: number, keepPlaying = false) {
    if (!keepPlaying) setPlaying(false);
    if (number < 1 || number > definition.steps.length) return;
    try {
      await act({ type: 'lesson-step', id: saved.id, step: number });
    } catch (e) {
      setPlaying(false);
      setError(String(e));
    }
  }
  useEffect(() => {
    title.current?.focus();
  }, []);
  useEffect(() => {
    setTransfer(0);
  }, [saved.step]);
  useEffect(() => {
    const fail = (e: Event) => setError((e as CustomEvent<string>).detail);
    window.addEventListener('tutor-error', fail);
    return () => window.removeEventListener('tutor-error', fail);
  }, []);
  useEffect(() => {
    if (r?.input !== 'idle' || r?.activity === 'speaking') setPlaying(false);
  }, [r?.input, r?.activity]);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (saved.step === definition.steps.length) setPlaying(false);
      else void go(saved.step + 1, true);
    }, 9000);
    return () => clearTimeout(timer);
  }, [playing, saved.id, saved.step]);
  useEffect(() => {
    if (!playing || step.scene !== 'transfer' || reduced) return;
    const start = performance.now();
    const timer = setInterval(
      () => setTransfer(Math.min(100, (performance.now() - start) / 45)),
      40,
    );
    return () => clearInterval(timer);
  }, [playing, step.scene, reduced]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('button,input,textarea,select,a,[contenteditable]')
      )
        return;
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        void go(saved.step + 1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        void go(saved.step - 1);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        void act({ type: 'lesson-close' });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [saved.step, saved.id]);
  return (
    <main className="visual-lesson">
      <header className="visual-lesson-header">
        <div>
          <p className="eyebrow">{definition.subtitle}</p>
          <h1 ref={title} tabIndex={-1}>
            {definition.title}
          </h1>
        </div>
        <button className="button" onClick={() => void act({ type: 'lesson-close' })}>
          <X size={17} /> {r?.lecture ? 'Back to lecture' : 'Back to tutor'}
        </button>
      </header>
      <div className="lesson-step-tabs" aria-label="Lesson steps">
        {definition.steps.map((s, index) => (
          <button
            key={s.scene}
            aria-current={saved.step === index + 1 ? 'step' : undefined}
            onClick={() => void go(index + 1)}
          >
            <span>{index + 1}</span>
            {s.title}
          </button>
        ))}
      </div>
      <section className="lesson-body glass">
        <div className="lesson-diagram">
          <span className="lesson-diagram-label">Schematic · not to scale</span>
          <LessonScene scene={step.scene} transfer={transfer} />
          {step.scene === 'transfer' && (
            <label className="lesson-scrubber">
              Follow the phosphate{' '}
              <input
                aria-label="Phosphate transfer"
                type="range"
                min="0"
                max="100"
                value={transfer}
                onChange={(e) => {
                  setPlaying(false);
                  setTransfer(Number(e.target.value));
                }}
              />
              <span>{transfer === 100 ? 'Transferred' : `${Math.round(transfer)}%`}</span>
            </label>
          )}
          {step.scene === 'products' && (
            <small>Biochemical shorthand; proton balance and ionic forms are omitted.</small>
          )}
        </div>
        <article className="lesson-explanation" aria-live="polite">
          <p className="eyebrow">
            Step {saved.step} of {definition.steps.length}
          </p>
          <h2>{step.title}</h2>
          <p>{step.text}</p>
          <blockquote>{step.takeaway}</blockquote>
          <GenerationPanel
            media={media}
            subject={step.analogy}
            lessonId={saved.id}
            lessonStep={saved.step}
          />
        </article>
      </section>
      {(error || r?.error) && (
        <div className="banner error" role="alert">
          {error || r?.error}
          <button onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      <footer className="lesson-controls">
        <div className="toolbar-group">
          <button
            className="button"
            disabled={saved.step === 1}
            onClick={() => void go(saved.step - 1)}
          >
            <ArrowLeft size={16} />
            Previous step
          </button>
          <button
            className="button primary"
            disabled={saved.step === definition.steps.length}
            onClick={() => void go(saved.step + 1)}
          >
            Next step
            <ArrowRight size={16} />
          </button>
          <button
            className="icon-button"
            aria-label={playing ? 'Pause lesson' : 'Play lesson'}
            disabled={!playing && saved.step === definition.steps.length}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            className="icon-button"
            aria-label="Replay lesson"
            onClick={() => {
              setTransfer(0);
              void go(1);
            }}
          >
            <RotateCcw size={18} />
          </button>
        </div>
        <div className="toolbar-group">
          <button
            className="button"
            disabled={!r?.config.voice || r?.status === 'connecting' || r?.input !== 'idle'}
            onClick={() => {
              setPlaying(false);
              setError('');
              void act({ type: 'lesson-narrate' }).catch((e) => setError(String(e)));
            }}
          >
            <Volume2 size={17} />
            Explain this step
          </button>
          {r?.sessionId && (
            <button className="button" onClick={() => void act({ type: 'pause' })}>
              Stop voice
            </button>
          )}
          <HoldButton />
        </div>
      </footer>
      <div className="lesson-footnote">
        <span role="status">
          Saved on this Mac · Step {saved.step} of {definition.steps.length}
        </span>
        <span>Space / → next · ← previous · Esc back</span>
      </div>
      <details className="lesson-sources">
        <summary>Scientific sources & diagram scope</summary>
        <p>
          Authored teaching diagram. Phosphate groups are symbols; the diagram does not show atom
          geometry, electron movement, kinetics or an activation-energy curve. Playback timing is
          for reading, not reaction speed or evidence of learning.
        </p>
        {definition.sources.map((source) => (
          <p key={source.url}>
            {source.title}
            <br />
            <small>{source.url}</small>
          </p>
        ))}
      </details>
    </main>
  );
}
