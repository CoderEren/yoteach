import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ClipboardCheck, Volume2, X } from 'lucide-react';
import type { AppState } from '../../shared/model';
import type { ScreenDrawing } from '../../shared/drawing';
import { layoutDiagram, type Diagram } from '../../shared/drawing';
import { lessonDefinition } from '../../shared/lessons';
import { api } from '../api';
import { useTutor } from '../tutor';
import { AnnotationLayer } from './TutorWorkspace';
import { LessonScene } from './LessonScene';
import { GenerationPanel } from './GeneratedMedia';
import { PracticePanel } from './Practice';

type Box = { x: number; y: number; width: number; height: number };
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}
/** Strokes draw themselves in, one after another, like a hand-drawn explanation. */
const stroke = (i: number) => ({ animationDelay: `${i * 0.35}s` });
function arrowHead(x: number, y: number, angle: number, size = 14) {
  const a = angle + Math.PI - 0.45,
    b = angle + Math.PI + 0.45;
  return `M ${x + size * Math.cos(a)} ${y + size * Math.sin(a)} L ${x} ${y} L ${x + size * Math.cos(b)} ${y + size * Math.sin(b)}`;
}
/** Marks and connections on grounded regions, in pixels of whatever surface it covers. */
export function DrawingLayer({ drawing }: { drawing: ScreenDrawing | null }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const px = (b: Box) => ({ x: b.x * w, y: b.y * h, w: b.width * w, h: b.height * h });
  return (
    <div className="drawing-layer" ref={ref} aria-hidden="true">
      {w > 0 && drawing && (
        <svg width={w} height={h} key={drawing.revision}>
          {drawing.marks.map((m, i) => {
            const b = px(m.box),
              cx = b.x + b.w / 2,
              cy = b.y + b.h / 2,
              pad = 8;
            const labelRight = b.x + b.w + 230 < w;
            const lx = labelRight ? b.x + b.w + 14 : b.x - 14,
              ly = Math.max(24, b.y - 10);
            return (
              <g key={m.id} className={`mark mark-${m.shape}`}>
                {m.shape === 'highlight' && (
                  <rect
                    className="draw fill"
                    style={stroke(i)}
                    x={b.x - 3}
                    y={b.y - 2}
                    width={b.w + 6}
                    height={b.h + 4}
                    rx={4}
                    pathLength={1}
                  />
                )}
                {m.shape === 'box' && (
                  <rect
                    className="draw"
                    style={stroke(i)}
                    x={b.x - pad}
                    y={b.y - pad}
                    width={b.w + pad * 2}
                    height={b.h + pad * 2}
                    rx={8}
                    pathLength={1}
                  />
                )}
                {m.shape === 'circle' && (
                  <ellipse
                    className="draw"
                    style={stroke(i)}
                    cx={cx}
                    cy={cy}
                    rx={b.w / 2 + 18}
                    ry={b.h / 2 + 14}
                    pathLength={1}
                  />
                )}
                {m.shape === 'underline' && (
                  <path
                    className="draw"
                    style={stroke(i)}
                    d={`M ${b.x} ${b.y + b.h + 5} q ${b.w / 4} 5 ${b.w / 2} 0 t ${b.w / 2} 0`}
                    pathLength={1}
                  />
                )}
                {m.shape === 'arrow' && (
                  <>
                    <path
                      className="draw"
                      style={stroke(i)}
                      d={`M ${Math.max(10, b.x - 110)} ${Math.max(10, cy - 70)} Q ${b.x - 70} ${cy - 5} ${b.x - 8} ${cy}`}
                      pathLength={1}
                    />
                    <path
                      className="draw"
                      style={stroke(i + 0.6)}
                      d={arrowHead(b.x - 8, cy, Math.atan2(5, 62))}
                      pathLength={1}
                    />
                  </>
                )}
                {m.shape === 'point' && (
                  <circle
                    className="draw dot"
                    style={stroke(i)}
                    cx={cx}
                    cy={cy}
                    r={8}
                    pathLength={1}
                  />
                )}
                {m.label && (
                  <text
                    className="mark-label"
                    style={stroke(i + 0.5)}
                    x={lx}
                    y={ly}
                    textAnchor={labelRight ? 'start' : 'end'}
                  >
                    {m.label}
                  </text>
                )}
              </g>
            );
          })}
          {drawing.connections.map((c, i) => {
            const a = px(c.from),
              b = px(c.to);
            const s = { x: a.x + a.w / 2, y: a.y + a.h / 2 },
              t = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
            const dx = t.x - s.x,
              dy = t.y - s.y,
              len = Math.hypot(dx, dy) || 1;
            // Start and end just outside each region so the text stays readable.
            const out = (p: { x: number; y: number }, r: { w: number; h: number }, dir: number) => {
              const k =
                Math.min(
                  r.w / 2 / Math.abs(dx / len || 1e-6),
                  r.h / 2 / Math.abs(dy / len || 1e-6),
                ) + 10;
              return { x: p.x + (dx / len) * k * dir, y: p.y + (dy / len) * k * dir };
            };
            const p = out(s, a, 1),
              q = out(t, b, -1);
            const mx = (p.x + q.x) / 2 - (dy / len) * 40,
              my = (p.y + q.y) / 2 + (dx / len) * 40;
            const n = drawing.marks.length + i;
            return (
              <g key={c.id} className="connection">
                <path
                  className="draw"
                  style={stroke(n)}
                  d={`M ${p.x} ${p.y} Q ${mx} ${my} ${q.x} ${q.y}`}
                  pathLength={1}
                />
                <path
                  className="draw"
                  style={stroke(n + 0.6)}
                  d={arrowHead(q.x, q.y, Math.atan2(q.y - my, q.x - mx))}
                  pathLength={1}
                />
                {c.label && (
                  <text
                    className="mark-label"
                    style={stroke(n + 0.7)}
                    x={mx}
                    y={my}
                    textAnchor="middle"
                  >
                    {c.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
/** A concept sketch laid out by the app, drawn in node by node. */
export function DiagramSketch({ diagram, onClose }: { diagram: Diagram; onClose?: () => void }) {
  const l = layoutDiagram(diagram);
  return (
    <figure className="diagram-sketch">
      <figcaption>
        <span>{diagram.title}</span>
        {onClose && (
          <button className="icon-button small" aria-label="Clear Yoyo’s drawing" onClick={onClose}>
            <X size={15} />
          </button>
        )}
      </figcaption>
      <svg
        viewBox={`0 0 ${l.width} ${l.height}`}
        width={l.width}
        height={l.height}
        role="img"
        aria-label={diagram.title}
      >
        {l.nodes.map((n, i) => (
          <g key={n.id} className="diagram-node">
            <rect
              className="draw"
              style={stroke(i)}
              x={n.x - n.w / 2}
              y={n.y - n.h / 2}
              width={n.w}
              height={n.h}
              rx={14}
              pathLength={1}
            />
            <foreignObject
              x={n.x - n.w / 2 + 6}
              y={n.y - n.h / 2 + 4}
              width={n.w - 12}
              height={n.h - 8}
            >
              <div className="diagram-text" style={stroke(i + 0.4)}>
                {n.label}
              </div>
            </foreignObject>
          </g>
        ))}
        {l.edges.map((e, i) => (
          <g key={i} className="diagram-edge">
            <path className="draw" style={stroke(l.nodes.length + i)} d={e.d} pathLength={1} />
            <path
              className="draw"
              style={stroke(l.nodes.length + i + 0.5)}
              d={arrowHead(e.tip.x, e.tip.y, e.tip.angle, 11)}
              pathLength={1}
            />
            {e.label && (
              <text
                className="mark-label small"
                style={stroke(l.nodes.length + i + 0.6)}
                x={e.lx}
                y={e.ly - 9}
                textAnchor="middle"
              >
                {e.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}
/** Clickable island in an otherwise click-through layer. */
function Interactive({ className, children }: { className: string; children: ReactNode }) {
  useEffect(() => () => void api.overlay.interactive(false), []);
  return (
    <section
      className={className}
      onMouseEnter={() => void api.overlay.interactive(true)}
      onMouseLeave={() => void api.overlay.interactive(false)}
    >
      {children}
    </section>
  );
}
function ScreenLesson({ data, side }: { data: AppState; side: 'left' | 'right' }) {
  const { runtime: r, act } = useTutor();
  const saved = data.lessons.find((l) => l.id === r?.activeLessonId);
  const [transfer, setTransfer] = useState(100);
  if (!saved || !r) return null;
  const definition = lessonDefinition(saved.key),
    step = definition.steps[saved.step - 1];
  const go = (n: number) =>
    n >= 1 &&
    n <= definition.steps.length &&
    void act({ type: 'lesson-step', id: saved.id, step: n });
  if (r.practice)
    return (
      <Interactive className={`screen-card glass ${side}`}>
        <PracticePanel
          attempts={data.attempts}
          voiceOnly
          onReview={(n) => {
            void act({ type: 'practice-close' }).then(() => go(n));
          }}
        />
      </Interactive>
    );
  return (
    <Interactive className={`screen-card glass ${side}`}>
      <header className="screen-card-header">
        <div>
          <p className="eyebrow">
            {definition.subtitle} · Step {saved.step} of {definition.steps.length}
          </p>
          <h2>{step.title}</h2>
        </div>
        <button
          className="icon-button small"
          aria-label="Close lesson"
          onClick={() => void act({ type: 'lesson-close' })}
        >
          <X size={16} />
        </button>
      </header>
      <div className="screen-card-scene">
        <span className="lesson-diagram-label">Schematic · not to scale</span>
        <LessonScene scene={step.scene} transfer={step.scene === 'transfer' ? transfer : 100} />
        {step.scene === 'transfer' && (
          <input
            aria-label="Phosphate transfer"
            type="range"
            min="0"
            max="100"
            value={transfer}
            onChange={(e) => setTransfer(Number(e.target.value))}
          />
        )}
      </div>
      <p>{step.text}</p>
      <blockquote>{step.takeaway}</blockquote>
      <GenerationPanel
        media={data.media}
        subject={step.analogy}
        lessonId={saved.id}
        lessonStep={saved.step}
      />
      <footer className="screen-card-actions">
        <button
          className="icon-button small"
          aria-label="Previous step"
          disabled={saved.step === 1}
          onClick={() => go(saved.step - 1)}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          className="icon-button small"
          aria-label="Next step"
          disabled={saved.step === definition.steps.length}
          onClick={() => go(saved.step + 1)}
        >
          <ArrowRight size={16} />
        </button>
        <button
          className="button small"
          disabled={!r.config.voice || r.status === 'connecting' || r.input !== 'idle'}
          onClick={() => void act({ type: 'lesson-narrate' })}
        >
          <Volume2 size={15} /> Explain
        </button>
        <button className="button small" onClick={() => void act({ type: 'practice-open' })}>
          <ClipboardCheck size={15} /> Practice
        </button>
      </footer>
    </Interactive>
  );
}
/** Yoyo's drawing surface over the user's own screen. Clicks pass through except on cards. */
export function DesktopOverlay({ data }: { data: AppState }) {
  const { runtime: r, act } = useTutor();
  if (!r || r.lecture) return <main className="desktop-overlay" />;
  const onScreen = r.snapshot?.source.kind === 'screen';
  const lesson = !!r.activeLessonId && r.lessonSurface === 'screen';
  const media = !lesson && !!r.generation && r.generation.origin === 'tutor' && !r.activeLessonId;
  const card = lesson || media;
  // Cards and sketches never cover what Yoyo is marking: the card takes the side without
  // marks, and the sketch takes the other side, dropping to the bottom when marks are there.
  const marks = onScreen ? (r.drawing?.marks ?? []) : [];
  const centre = (b: { x: number; width: number }) => b.x + b.width / 2;
  const markedRight = marks.length
    ? marks.reduce((s, m) => s + centre(m.box), 0) / marks.length >= 0.5
    : false;
  const cardSide = markedRight ? 'left' : 'right';
  const sketchSide = card
    ? cardSide === 'left'
      ? 'right'
      : 'left'
    : markedRight
      ? 'left'
      : 'right';
  const sketchLow = marks.some((m) =>
    sketchSide === 'left' ? centre(m.box) < 0.5 : centre(m.box) >= 0.5,
  );
  return (
    <main className="desktop-overlay">
      <AnnotationLayer
        annotations={
          onScreen
            ? r.annotations.filter(
                (a) => a.id === r.focusRegion && !r.drawing?.marks.some((m) => m.regionId === a.id),
              )
            : []
        }
      />
      <DrawingLayer
        drawing={
          onScreen ? r.drawing : r.drawing ? { ...r.drawing, marks: [], connections: [] } : null
        }
      />
      {r.drawing?.diagram && (
        <Interactive className={`screen-sketch ${sketchSide}${sketchLow ? ' low' : ''}`}>
          <DiagramSketch
            diagram={r.drawing.diagram}
            onClose={() => void act({ type: 'screen-clear' })}
          />
        </Interactive>
      )}
      {lesson && <ScreenLesson data={data} side={cardSide} />}
      {media && (
        <Interactive className={`screen-card glass ${cardSide}`}>
          <header className="screen-card-header">
            <h2>Yoyo’s visual analogy</h2>
          </header>
          <GenerationPanel media={data.media} />
        </Interactive>
      )}
      {!r.drawing?.diagram &&
        onScreen &&
        !!(r.drawing?.marks.length || r.drawing?.connections.length) && (
          <Interactive className="screen-clear">
            <button className="button small" onClick={() => void act({ type: 'screen-clear' })}>
              <X size={14} /> Clear drawing
            </button>
          </Interactive>
        )}
    </main>
  );
}
