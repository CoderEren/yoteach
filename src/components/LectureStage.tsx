import { useEffect } from 'react';
import { useTutor } from '../tutor';
import { AnnotationLayer } from './TutorWorkspace';
import { HoldButton } from './HoldButton';
import { GenerationPanel } from './GeneratedMedia';
import { DiagramSketch, DrawingLayer } from './DesktopOverlay';
import type { GeneratedMedia } from '../../shared/media';
export function LectureStage({ media }: { media: GeneratedMedia[] }) {
  const { runtime: r, act } = useTutor();
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void act({ type: 'end' });
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  if (!r?.lecture) return null;
  const snapshot = r.snapshot?.source.kind === 'pdf' ? r.snapshot : null;
  return (
    <main className="lecture-stage">
      <div className="lecture-slide">
        {snapshot ? (
          <div
            className="lecture-slide-image"
            style={{
              aspectRatio: `${snapshot.width} / ${snapshot.height}`,
              width: `min(100%, calc((100vh - 76px) * ${snapshot.width / snapshot.height}))`,
            }}
          >
            <img src={snapshot.image} alt={`Lecture slide ${r.lecture.page}`} />
            <AnnotationLayer
              annotations={r.annotations.filter(
                (a) => a.id === r.focusRegion && !r.drawing?.marks.some((m) => m.regionId === a.id),
              )}
            />
            <DrawingLayer drawing={r.drawing?.snapshotId === snapshot.id ? r.drawing : null} />
          </div>
        ) : (
          <p role="status">Preparing slide {r.lecture.page}…</p>
        )}
        {r.drawing?.diagram && (
          <aside className="lecture-sketch">
            <DiagramSketch
              diagram={r.drawing.diagram}
              onClose={() => void act({ type: 'screen-clear' })}
            />
          </aside>
        )}
        {r.generation && (
          <aside className="lecture-generation glass">
            <GenerationPanel media={media} />
          </aside>
        )}
        {r.error && (
          <div className="lecture-error" role="alert">
            {r.error}
          </div>
        )}
      </div>
      <footer className="lecture-controls">
        <button
          className="button small"
          disabled={r.lecture.page <= 1 || r.lecturePreparing}
          onClick={() => void act({ type: 'lecture-page', page: r.lecture!.page - 1 })}
        >
          Previous slide
        </button>
        <span>
          Slide {r.lecture.page} / {r.lecture.total}
        </span>
        <button
          className="button small"
          disabled={r.lecture.page >= r.lecture.total || r.lecturePreparing}
          onClick={() => void act({ type: 'lecture-page', page: r.lecture!.page + 1 })}
        >
          Next slide
        </button>
        <HoldButton />
        <button className="button small" onClick={() => void act({ type: 'pause' })}>
          Pause
        </button>
        <button className="button small" onClick={() => void act({ type: 'end' })}>
          End lecture
        </button>
      </footer>
    </main>
  );
}
