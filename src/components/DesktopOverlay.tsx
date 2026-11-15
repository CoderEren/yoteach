import { useEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { ArrowLeft, ArrowRight, ClipboardCheck, Volume2, X } from 'lucide-react';
import type { AppState } from '../../shared/model';
import type { TutorRuntime } from '../../shared/tutor';
import type { ScreenDrawing } from '../../shared/drawing';
import { layoutDiagram, type Diagram, type Sketch, type SketchElement } from '../../shared/drawing';
import { freeSpot, labelSpot } from '../../shared/grounding';
import { lessonDefinition } from '../../shared/lessons';
import { api } from '../api';
import { useTutor } from '../tutor';
import { AnnotationLayer } from './TutorWorkspace';
import {
  drawOn,
  handArrow,
  handBox,
  handLine,
  handUnderline,
  wobbleEllipse,
} from '../drawing/hand';
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
/** Label size in pixels, measured in the handwriting font. */
let ruler: CanvasRenderingContext2D | null = null;
const labelSize = (text: string) => {
  ruler ??= document.createElement('canvas').getContext('2d');
  if (ruler) ruler.font = "700 27px Caveat, 'Bradley Hand', cursive";
  const w = ruler ? ruler.measureText(text).width : text.length * 11.5;
  return { w: w + 16, h: 32 };
};
/**
 * Marks and connections on grounded regions, drawn by hand in pixels of whatever surface it
 * covers. Labels go where they cover no recognised text and no other label.
 */
export function DrawingLayer({
  drawing,
  avoid = [],
}: {
  drawing: ScreenDrawing | null;
  avoid?: { x: number; y: number; width: number; height: number }[];
}) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!svg.current || !drawing || !w) return;
    return drawOn(svg.current, {
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      // Yoyo flies to the first mark first; the ink starts as it arrives.
      delay: drawing.marks.length || drawing.connections.length ? 0.5 : 0,
    });
  }, [drawing?.revision, w > 0]);
  if (!drawing) return <div className="drawing-layer" ref={ref} aria-hidden="true" />;
  const px = (b: { x: number; y: number; width: number; height: number }) => ({
    x: b.x * w,
    y: b.y * h,
    w: b.width * w,
    h: b.height * h,
  });
  // Text and earlier labels are obstacles for each new label (normalized space).
  const taken = [...avoid, ...drawing.marks.map((m) => m.box)];
  const seed = (i: number) => (drawing.revision * 17 + i * 7) % 97;
  return (
    <div className="drawing-layer" ref={ref} aria-hidden="true">
      {w > 0 && (
        <svg width={w} height={h} key={drawing.revision} ref={svg}>
          {drawing.marks.map((m, i) => {
            const b = px(m.box),
              cx = b.x + b.w / 2,
              cy = b.y + b.h / 2;
            const size = m.label ? labelSize(m.label) : null;
            const spot = size
              ? labelSpot(m.box, { width: size.w / w, height: size.h / h }, taken)
              : null;
            if (spot) taken.push(spot);
            const lx = spot ? spot.x * w : 0,
              ly = spot ? spot.y * h : 0;
            // Arrows start from their label (or a free point) and end at the mark's edge.
            const tail = spot
              ? { x: lx + size!.w / 2, y: ly + size!.h / 2 }
              : { x: Math.max(12, b.x - 110), y: Math.max(12, cy - 70) };
            const arrow =
              m.shape === 'arrow'
                ? handArrow(tail.x, tail.y, tail.x < cx ? b.x - 6 : b.x + b.w + 6, cy, seed(i))
                : null;
            return (
              <g key={m.id} className={`mark mark-${m.shape} boil`}>
                {m.shape === 'highlight' &&
                  (m.parts ?? [m.box])
                    .map(px)
                    .map((p, k) => (
                      <path
                        key={k}
                        className="ink marker"
                        d={handLine(
                          p.x - 3,
                          p.y + p.h / 2,
                          p.x + p.w + 3,
                          p.y + p.h / 2,
                          seed(i) + k,
                          0.01,
                        )}
                        style={{ strokeWidth: Math.max(10, p.h * 1.05) }}
                      />
                    ))}
                {m.shape === 'box' && (
                  <path
                    className="ink"
                    d={handBox(b.x - 6, b.y - 5, b.w + 12, b.h + 10, seed(i))}
                  />
                )}
                {m.shape === 'circle' && (
                  <path
                    className="ink"
                    d={wobbleEllipse(
                      cx,
                      cy,
                      b.w / 2 + Math.max(12, b.h * 0.5),
                      b.h / 2 + Math.max(9, b.h * 0.55),
                      seed(i),
                    )}
                  />
                )}
                {m.shape === 'underline' &&
                  (m.parts ?? [m.box])
                    .map(px)
                    .map((p, k) => (
                      <path
                        key={k}
                        className="ink"
                        d={handUnderline(p.x, p.y + p.h + 4, p.w, seed(i) + k)}
                      />
                    ))}
                {arrow && (
                  <>
                    <path className="ink" d={arrow.shaft} />
                    <path className="ink" d={arrow.head} />
                  </>
                )}
                {m.shape === 'point' && (
                  <>
                    <circle className="ink dot" cx={cx} cy={cy} r={7} />
                    <path className="ink" d={wobbleEllipse(cx, cy, 15, 15, seed(i), 6)} />
                  </>
                )}
                {m.label && spot && m.shape !== 'arrow' && (
                  <path
                    className="ink leader"
                    d={handLine(
                      lx < b.x ? lx + size!.w : lx > b.x + b.w ? lx : lx + size!.w / 2,
                      ly + size!.h / 2,
                      lx < b.x ? b.x - 4 : lx > b.x + b.w ? b.x + b.w + 4 : cx,
                      ly + size!.h / 2 < b.y ? b.y - 4 : ly > b.y + b.h ? b.y + b.h + 4 : cy,
                      seed(i) + 5,
                      0.12,
                    )}
                  />
                )}
                {m.label && spot && (
                  <text className="ink-label" x={lx + 7} y={ly + size!.h * 0.72}>
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
            const out = (p: { x: number; y: number }, r: { w: number; h: number }, dir: number) => {
              const k =
                Math.min(
                  r.w / 2 / Math.abs(dx / len || 1e-6),
                  r.h / 2 / Math.abs(dy / len || 1e-6),
                ) + 12;
              return { x: p.x + (dx / len) * k * dir, y: p.y + (dy / len) * k * dir };
            };
            const p = out(s, a, 1),
              q = out(t, b, -1);
            const arrow = handArrow(p.x, p.y, q.x, q.y, seed(i + 40));
            const size = c.label ? labelSize(c.label) : null;
            const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
            const spot = size
              ? labelSpot(
                  { x: mid.x / w - 0.005, y: mid.y / h - 0.005, width: 0.01, height: 0.01 },
                  { width: size.w / w, height: size.h / h },
                  taken,
                )
              : null;
            if (spot) taken.push(spot);
            return (
              <g key={c.id} className="connection boil">
                <path className="ink" d={arrow.shaft} />
                <path className="ink" d={arrow.head} />
                {c.label && spot && (
                  <text className="ink-label" x={spot.x * w + 7} y={spot.y * h + size!.h * 0.72}>
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
const tone = (t?: string) => `tone-${t ?? 'ink'}`;
/** Smooth closed outline through points (closed Catmull-Rom). */
function smoothClosed(points: [number, number][]) {
  const n = points.length,
    at = (k: number) => points[(k + n) % n];
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1),
      p1 = at(i),
      p2 = at(i + 1),
      p3 = at(i + 2);
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return d + ' Z';
}
/** Particles that keep travelling along a path (ions, blood, electrons). Loops forever. */
function Flow({ e }: { e: Extract<SketchElement, { type: 'flow' }> }) {
  const path = useRef<SVGPathElement>(null),
    group = useRef<SVGGElement>(null);
  const d = smooth(e.path);
  useEffect(() => {
    const p = path.current,
      g = group.current;
    if (!p || !g || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const L = p.getTotalLength();
    const dots = Array.from(g.querySelectorAll<SVGGElement>('.particle'));
    const tweens = dots.map((dot, k) => {
      const state = { t: k / dots.length };
      return gsap.to(state, {
        t: state.t + 1,
        duration: e.seconds,
        ease: 'none',
        repeat: -1,
        onUpdate: () => {
          const pt = p.getPointAtLength((state.t % 1) * L);
          dot.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
        },
      });
    });
    return () => tweens.forEach((t) => t.kill());
  }, [d, e.count, e.seconds]);
  return (
    <g className={`flow ${tone(e.tone)} ink-label`} ref={group}>
      <path ref={path} className="flow-track" d={d} />
      {Array.from({ length: e.count }, (_, k) => (
        <g key={k} className="particle" transform={`translate(${e.path[0][0]} ${e.path[0][1]})`}>
          <circle r={e.symbol ? 2 : 1.1} />
          {e.symbol && (
            <text textAnchor="middle" y={0.6}>
              {e.symbol}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

/** Smooth path through points (Catmull-Rom as cubic Béziers). */
function smooth(points: [number, number][]) {
  if (points.length < 3) return `M ${points.map((p) => p.join(' ')).join(' L ')}`;
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i],
      p1 = points[i],
      p2 = points[i + 1],
      p3 = points[i + 2] ?? p2;
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return d;
}
function SketchItem({ e, i }: { e: SketchElement; i: number }) {
  const s = stroke(i);
  const label = (x: number, y: number, text?: string, anchor: 'start' | 'middle' = 'middle') =>
    text ? (
      <text
        className="sketch-label ink-label"
        style={stroke(i + 0.5)}
        x={x}
        y={y}
        textAnchor={anchor}
      >
        {text}
      </text>
    ) : null;
  const dash = (d?: boolean) => (d ? 'draw ink dashed' : 'draw ink');
  switch (e.type) {
    case 'arrow':
    case 'line': {
      const [x1, y1] = e.from,
        [x2, y2] = e.to;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      return (
        <g className={tone(e.tone)}>
          <path
            className={dash(e.dashed)}
            style={s}
            d={`M ${x1} ${y1} L ${x2} ${y2}`}
            pathLength={1}
          />
          {e.type === 'arrow' && (
            <path
              className="draw ink"
              style={stroke(i + 0.4)}
              d={arrowHead(x2, y2, angle, 2.6)}
              pathLength={1}
            />
          )}
          {label(
            (x1 + x2) / 2 + Math.sin(angle) * 4.6,
            (y1 + y2) / 2 - Math.cos(angle) * 4.6 + 1,
            e.label,
          )}
        </g>
      );
    }
    case 'curve':
      return (
        <g className={tone(e.tone)}>
          <path
            className={dash(e.dashed)}
            style={{ ...s, strokeWidth: e.width }}
            d={smooth(e.points)}
            pathLength={1}
          />
          {label(e.points.at(-1)![0] + 1.5, e.points.at(-1)![1] - 1.5, e.label, 'start')}
        </g>
      );
    case 'circle':
      return (
        <g className={tone(e.tone)}>
          <circle className="draw ink" style={s} cx={e.at[0]} cy={e.at[1]} r={e.r} pathLength={1} />
          {label(e.at[0], e.at[1] + 1.2, e.label)}
        </g>
      );
    case 'box':
      return (
        <g className={tone(e.tone)}>
          <rect
            className="draw ink"
            style={s}
            x={e.at[0]}
            y={e.at[1]}
            width={e.w}
            height={e.h}
            rx={1.5}
            pathLength={1}
          />
          {label(e.at[0] + e.w / 2, e.at[1] + e.h / 2 + 1.2, e.label)}
        </g>
      );
    case 'dot':
      return (
        <g className={tone(e.tone)}>
          <circle
            className="draw ink dot"
            style={s}
            cx={e.at[0]}
            cy={e.at[1]}
            r={0.9}
            pathLength={1}
          />
          {label(e.at[0] + 1.8, e.at[1] - 1.4, e.label, 'start')}
        </g>
      );
    case 'text':
      return <g className={tone(e.tone)}>{label(e.at[0], e.at[1], e.text, 'start')}</g>;
    case 'shape':
      return (
        <g className={`${tone(e.tone)} ${e.fill ? `fill-${e.fill}` : ''}`}>
          <path
            className="draw ink shape"
            style={{ ...s, strokeWidth: e.width }}
            d={smoothClosed(e.points)}
            pathLength={1}
          />
          {label(
            e.points.reduce((a, p) => a + p[0], 0) / e.points.length,
            e.points.reduce((a, p) => a + p[1], 0) / e.points.length + 1.2,
            e.label,
          )}
        </g>
      );
    case 'ellipse':
      return (
        <g className={`${tone(e.tone)} ${e.fill ? `fill-${e.fill}` : ''}`}>
          <ellipse
            className="draw ink shape"
            style={s}
            cx={e.at[0]}
            cy={e.at[1]}
            rx={e.rx}
            ry={e.ry}
            pathLength={1}
          />
          {label(e.at[0], e.at[1] + 1.2, e.label)}
        </g>
      );
    case 'flow':
      return (
        <>
          <Flow e={e} />
          {label(e.path.at(-1)![0] + 1.5, e.path.at(-1)![1] - 1.8, e.label, 'start')}
        </>
      );
    case 'pulse':
      return (
        <g className={`pulse ${tone(e.tone)} ink-label`}>
          <path
            className="pulse-band"
            d={smooth(e.path)}
            pathLength={1}
            style={{ animationDuration: `${e.seconds}s`, strokeWidth: (e.width ?? 1.4) * 2.2 }}
          />
          {label(e.path[0][0], e.path[0][1] - 2.5, e.label, 'start')}
        </g>
      );
    case 'axes': {
      const [x, y] = e.origin;
      return (
        <g className="tone-muted">
          <path
            className="draw ink"
            style={s}
            d={`M ${x} 2 L ${x} ${y} L 98 ${y}`}
            pathLength={1}
          />
          <path
            className="draw ink"
            style={stroke(i + 0.3)}
            d={arrowHead(x, 2, -Math.PI / 2, 2)}
            pathLength={1}
          />
          <path
            className="draw ink"
            style={stroke(i + 0.3)}
            d={arrowHead(98, y, 0, 2)}
            pathLength={1}
          />
          {label(97, y + 4, e.xLabel)}
          {label(x + 1.5, 4, e.yLabel, 'start')}
        </g>
      );
    }
  }
}
/** Where an element starts, for working out how far it should glide. */
function anchorOf(e: SketchElement): [number, number] {
  switch (e.type) {
    case 'arrow':
    case 'line':
      return e.from;
    case 'curve':
    case 'shape':
      return e.points[0];
    case 'flow':
    case 'pulse':
      return e.path[0];
    case 'axes':
      return e.origin;
    default:
      return e.at;
  }
}
/**
 * Yoyo's free-form drawing: vectors, graphs, geometry, processes. Plays like a short
 * HyperFrames scene in one consistent frame: the title writes in, elements draw by hand in
 * steps with a caption for each, and anything told to move glides into place.
 */
export function SketchCanvas({ sketch, onClose }: { sketch: Sketch; onClose?: () => void }) {
  const ref = useRef<SVGSVGElement>(null),
    title = useRef<HTMLSpanElement>(null);
  const [step, setStep] = useState(1);
  const caption = sketch.captions?.[Math.min(step, sketch.captions.length) - 1];
  useEffect(() => {
    if (!ref.current) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Explicit end values: a title replaced mid-animation must not freeze half-faded.
    const words = title.current ? Array.from(title.current.querySelectorAll('i')) : [];
    const intro = reduced
      ? gsap.set(words, { y: 0, opacity: 1 })
      : gsap.fromTo(
          words,
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.35, stagger: 0.06, ease: 'power2.out' },
        );
    const stop = drawOn(ref.current, { reduced, onStep: setStep, delay: 0.25 });
    return () => {
      intro.kill();
      gsap.set(words, { y: 0, opacity: 1 });
      stop();
    };
    // Replay only when the sketch itself changes, not on every runtime update.
  }, [JSON.stringify(sketch)]);
  return (
    <figure className={`diagram-sketch sketch-canvas ${sketch.size === 'large' ? 'large' : ''}`}>
      <figcaption>
        <span ref={title}>
          {sketch.title.split(' ').map((w, i) => (
            <i key={i} style={{ marginRight: '0.28em' }}>
              {w}
            </i>
          ))}
        </span>
        {onClose && (
          <button className="icon-button small" aria-label="Clear Yoyo’s drawing" onClick={onClose}>
            <X size={15} />
          </button>
        )}
      </figcaption>
      <svg
        ref={ref}
        viewBox="-2 -2 104 74"
        width={sketch.size === 'large' ? 780 : 560}
        height={sketch.size === 'large' ? 557 : 400}
        role="img"
        aria-label={sketch.title}
      >
        {sketch.elements.map((e, i) => {
          const [ax, ay] = anchorOf(e);
          const move = e.moveTo ? { 'data-mx': e.moveTo[0] - ax, 'data-my': e.moveTo[1] - ay } : {};
          return (
            <g key={i} className="sk-el" data-step={e.step ?? 1} {...move}>
              <SketchItem e={e} i={i} />
            </g>
          );
        })}
      </svg>
      {caption && (
        <p className="sketch-caption" key={step} aria-live="polite">
          {caption}
        </p>
      )}
    </figure>
  );
}
/** A concept sketch laid out by the app, drawn in node by node. */
export function DiagramSketch({ diagram, onClose }: { diagram: Diagram; onClose?: () => void }) {
  const l = layoutDiagram(diagram);
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current)
      return drawOn(ref.current, {
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
  }, [JSON.stringify(diagram)]);
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
        ref={ref}
        viewBox={`0 0 ${l.width} ${l.height}`}
        width={l.width}
        height={l.height}
        role="img"
        aria-label={diagram.title}
      >
        {l.nodes.map((n, i) => (
          <g key={n.id} className="diagram-node">
            <rect
              className="draw ink"
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
              <div className="diagram-text ink-label">{n.label}</div>
            </foreignObject>
          </g>
        ))}
        {l.edges.map((e, i) => (
          <g key={i} className="diagram-edge">
            <path className="draw ink" style={stroke(l.nodes.length + i)} d={e.d} pathLength={1} />
            <path
              className="draw ink"
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
function Interactive({
  className,
  children,
  style,
}: {
  className: string;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  useEffect(() => () => void api.overlay.interactive(false), []);
  return (
    <section
      className={className}
      style={style}
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
  const { runtime: r } = useTutor();
  return (
    <>
      {!r || r.lecture ? <main className="desktop-overlay" /> : <ScreenLayer data={data} r={r} />}
      <CursorInk />
    </>
  );
}
/**
 * The cursor's ink while the talk key is held: a violet trace that follows the pointer and
 * fades behind it, so circling or pointing at something is visible. Fades out on release.
 */
function CursorInk() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !api.overlay?.onTrail) return;
    const ctx = c.getContext('2d')!;
    let points: { x: number; y: number; t: number }[] = [],
      clock = { at: 0, offset: 0 },
      ended: number | null = null,
      frame = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const KEEP = 2600; // ms a segment stays before it has faded away
    const draw = () => {
      frame = 0;
      const dpr = window.devicePixelRatio || 1,
        w = window.innerWidth,
        h = window.innerHeight;
      if (c.width !== Math.round(w * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const now = performance.now() - clock.offset;
      const fadeOut = ended === null ? 1 : Math.max(0, 1 - (performance.now() - ended) / 1200);
      if (!points.length || fadeOut <= 0) return;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Segments of similar age go in one stroke; overlapping round caps of separate
      // translucent strokes would otherwise bead the line.
      let run: number[] = [],
        level = -1;
      const flush = () => {
        if (run.length && level > 0) {
          ctx.strokeStyle = `rgba(106, 69, 216, ${((0.92 * level) / 8).toFixed(3)})`;
          ctx.lineWidth = 3 + (2 * level) / 8;
          ctx.beginPath();
          const first = points[run[0] - 1],
            before = points[run[0] - 2] ?? first;
          ctx.moveTo(((before.x + first.x) / 2) * w, ((before.y + first.y) / 2) * h);
          for (const i of run) {
            const a = points[i - 1],
              b = points[i];
            // Through midpoints, so the ink is smooth rather than a polyline.
            ctx.quadraticCurveTo(a.x * w, a.y * h, ((a.x + b.x) / 2) * w, ((a.y + b.y) / 2) * h);
          }
          ctx.stroke();
        }
        run = [];
      };
      for (let i = 1; i < points.length; i++) {
        const age = reduced ? 0 : now - points[i].t;
        const l = Math.round(Math.max(0, 1 - age / KEEP) * fadeOut * 8);
        if (l !== level) {
          flush();
          level = l;
        }
        run.push(i);
      }
      flush();
      const head = points.at(-1)!;
      if (ended === null) {
        ctx.fillStyle = '#6a45d8';
        ctx.beginPath();
        ctx.arc(head.x * w, head.y * h, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const off = api.overlay.onTrail((e) => {
      if (e.type === 'start') {
        points = e.points.slice(-600);
        clock = { at: performance.now(), offset: performance.now() - (points.at(-1)?.t ?? 0) };
        ended = null;
      } else if (e.type === 'add') {
        points.push(e.point);
        if (points.length > 600) points.shift();
      } else ended = performance.now();
      kick();
    });
    return () => {
      off();
      cancelAnimationFrame(frame);
    };
  }, []);
  return <canvas ref={canvas} className="cursor-ink" aria-hidden="true" />;
}
function ScreenLayer({ data, r }: { data: AppState; r: TutorRuntime }) {
  const { act } = useTutor();
  const onScreen = r.snapshot?.source.kind === 'screen';
  const lesson = !!r.activeLessonId && r.lessonSurface === 'screen';
  const media = !lesson && !!r.generation && r.generation.origin === 'tutor' && !r.activeLessonId;
  const card = lesson || media;
  // Sketches and cards go where they cover the least text and none of Yoyo's marks.
  const marks = onScreen ? (r.drawing?.marks ?? []) : [];
  const text = onScreen ? (r.snapshot?.textBoxes.map((t) => t.box) ?? []) : [];
  const centre = (b: { x: number; width: number }) => b.x + b.width / 2;
  const markedRight = marks.length
    ? marks.reduce((s, m) => s + centre(m.box), 0) / marks.length >= 0.5
    : false;
  const cardSide = markedRight ? 'left' : 'right';
  const vw = window.innerWidth || 1440,
    vh = window.innerHeight || 900;
  const cardBox = card
    ? { x: cardSide === 'left' ? 0.02 : 1 - 0.02 - 460 / vw, y: 0.08, width: 460 / vw, height: 0.8 }
    : null;
  const panel = r.drawing?.sketch
    ? r.drawing.sketch.size === 'large'
      ? { width: Math.min(820, vw * 0.62) / vw, height: Math.min(640, vh * 0.8) / vh }
      : { width: 600 / vw, height: 470 / vh }
    : r.drawing?.diagram
      ? (() => {
          const l = layoutDiagram(r.drawing!.diagram!);
          const scale = Math.min(1, (vw * 0.46) / (l.width + 34), (vh * 0.6) / (l.height + 70));
          return { width: ((l.width + 34) * scale) / vw, height: ((l.height + 70) * scale) / vh };
        })()
      : null;
  const near = r.drawing?.sketch?.near ?? null;
  const spot = panel
    ? freeSpot(
        panel,
        [...text, ...marks.map((m) => m.box), ...(cardBox ? [cardBox, cardBox, cardBox] : [])],
        near ?? undefined,
      )
    : null;
  // Yoyo flies beside each new sketch, diagram or card it puts on screen.
  const focusKey = `${r.drawing?.revision ?? ''}:${spot ? 'panel' : ''}:${lesson ? r.activeLessonId : ''}:${media ? r.generation?.id : ''}`;
  useEffect(() => {
    if (spot && (r.drawing?.sketch || r.drawing?.diagram)) void api.overlay.focus(spot);
    else if (cardBox && (lesson || media)) void api.overlay.focus(cardBox);
  }, [focusKey]);
  const place = spot
    ? { left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, maxWidth: `${panel!.width * 100}%` }
    : undefined;
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
        avoid={text}
      />
      {r.drawing?.diagram && (
        <Interactive className="screen-sketch" style={place}>
          <DiagramSketch
            diagram={r.drawing.diagram}
            onClose={() => void act({ type: 'screen-clear' })}
          />
        </Interactive>
      )}
      {r.drawing?.sketch && (
        <Interactive className="screen-sketch" style={place}>
          <SketchCanvas
            sketch={r.drawing.sketch}
            onClose={() => void act({ type: 'screen-clear' })}
          />
        </Interactive>
      )}
      {lesson && <ScreenLesson data={data} side={cardSide} />}
      {media && (
        <Interactive className={`screen-card glass ${cardSide}`}>
          <header className="screen-card-header">
            <h2>Made by Yoyo</h2>
          </header>
          <GenerationPanel media={data.media} />
        </Interactive>
      )}
      {!r.drawing?.diagram &&
        !r.drawing?.sketch &&
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
