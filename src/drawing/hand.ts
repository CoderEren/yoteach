// Hand-drawn strokes for Yoyo's on-screen teaching.
// Adapted from the HyperFrames "hw-*" handwritten annotation family (hw-boil, hw-callout-circle,
// hw-arrow, marker-highlight), Copyright HeyGen, Apache License 2.0:
// https://github.com/heygen-com/hyperframes. Changes: TypeScript, pixel-space geometry for a live
// overlay, and live (not seek-driven) playback.
import gsap from 'gsap';

/** Seeded hash in [-1, 1]; a pure function, so every redraw of a mark looks the same. */
export function hash(n: number, seed = 1) {
  const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}
const f = (n: number) => n.toFixed(1);
/** A hand-wobbled ellipse as a smooth quadratic chain, starting slightly past the top-left. */
export function wobbleEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed = 1,
  wobble = 3,
) {
  const N = 14,
    pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - 2.2;
    const wr = 1 + hash(i * 13 + 5, seed) * (wobble / 100);
    pts.push([cx + Math.cos(a) * rx * wr, cy + Math.sin(a) * ry * wr]);
  }
  // Overshoot the start a little, like a real pen closing a loop.
  pts.push([pts[0][0] + rx * 0.12, pts[0][1] - ry * 0.05]);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let j = 1; j < pts.length - 1; j++) {
    const p = pts[j],
      q = pts[j + 1];
    d += ` Q${f(p[0])} ${f(p[1])} ${f((p[0] + q[0]) / 2)} ${f((p[1] + q[1]) / 2)}`;
  }
  return d + ` L${f(pts.at(-1)![0])} ${f(pts.at(-1)![1])}`;
}
/** A slightly bowed hand line between two points. */
export function handLine(x1: number, y1: number, x2: number, y2: number, seed = 1, bow = 0.04) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len,
    ny = (x2 - x1) / len;
  const k = len * bow * (0.6 + 0.4 * hash(seed * 7, seed));
  const mx = (x1 + x2) / 2 + nx * k,
    my = (y1 + y2) / 2 + ny * k;
  return `M${f(x1)} ${f(y1)} Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}`;
}
/** A hand-drawn rounded box: four bowed sides that overlap a touch at the corners. */
export function handBox(x: number, y: number, w: number, h: number, seed = 1) {
  const j = (n: number) => hash(n, seed) * 2.2;
  return [
    handLine(x - 3 + j(1), y + j(2), x + w + 3 + j(3), y + j(4), seed + 1, 0.015),
    handLine(x + w + j(5), y - 3 + j(6), x + w + j(7), y + h + 3 + j(8), seed + 2, 0.02),
    handLine(x + w + 3 + j(9), y + h + j(10), x - 3 + j(11), y + h + j(12), seed + 3, 0.015),
    handLine(x + j(13), y + h + 3 + j(14), x + j(15), y - 3 + j(16), seed + 4, 0.02),
  ].join(' ');
}
/** A gentle wave under text, a little wider than the words. */
export function handUnderline(x: number, y: number, w: number, seed = 1) {
  const a = 2.2 + hash(seed, seed) * 0.8;
  return `M${f(x - 4)} ${f(y)} q${f(w / 4)} ${f(a)} ${f(w / 2)} 0 t${f(w / 2 + 8)} ${f(-a * 0.4)}`;
}
/** A curved arrow shaft from a free point to a target, with a two-stroke head. */
export function handArrow(x1: number, y1: number, x2: number, y2: number, seed = 1) {
  const shaft = handLine(x1, y1, x2, y2, seed, 0.18);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  // The head follows the curve's arrival direction (from the bow's control point).
  const nx = -(y2 - y1) / len,
    ny = (x2 - x1) / len;
  const k = len * 0.18 * (0.6 + 0.4 * hash(seed * 7, seed));
  const cx = (x1 + x2) / 2 + nx * k,
    cy = (y1 + y2) / 2 + ny * k;
  const angle = Math.atan2(y2 - cy, x2 - cx),
    s = 13;
  const head = `M${f(x2 + s * Math.cos(angle + Math.PI - 0.5))} ${f(y2 + s * Math.sin(angle + Math.PI - 0.5))} L${f(x2)} ${f(y2)} L${f(x2 + s * Math.cos(angle + Math.PI + 0.45))} ${f(y2 + s * Math.sin(angle + Math.PI + 0.45))}`;
  return { shaft, head };
}
/**
 * Pen-velocity ease: a pen slows into curves and never stalls (HyperFrames hwPenEase, simplified).
 * Returns an ease mapping time to distance along the path.
 */
function penEase(path: SVGGeometryElement) {
  const L = path.getTotalLength();
  if (!(L > 0)) return (t: number) => t;
  const N = 40,
    pts = Array.from({ length: N + 1 }, (_, i) => path.getPointAtLength((L * i) / N));
  const time = [0];
  for (let i = 1; i <= N; i++) {
    const a = pts[i - 1],
      b = pts[i],
      c = pts[Math.min(N, i + 1)];
    const turn = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x));
    const speed = Math.max(0.22, 1 / (1 + 10 * Math.min(turn, Math.PI - turn) * 0.5));
    time.push(time[i - 1] + 1 / speed);
  }
  const total = time[N];
  return (t: number) => {
    const target = t * total;
    let i = 1;
    while (i < N && time[i] < target) i++;
    const span = time[i] - time[i - 1] || 1;
    return (i - 1 + (target - time[i - 1]) / span) / N;
  };
}
/**
 * Draw every `.ink` stroke in document order like handwriting, popping each `.ink-label` in
 * after the stroke before it. Then a calm hand-drawn "boil" keeps the ink alive.
 */
export function drawOn(
  root: SVGSVGElement | HTMLElement,
  opts: {
    reduced?: boolean;
    delay?: number;
    onStep?: (step: number) => void;
    stepGap?: number;
  } = {},
) {
  const items = Array.from(
    root.querySelectorAll<SVGGeometryElement | HTMLElement>('.ink, .ink-label'),
  );
  if (opts.reduced) {
    // clearProps runs after other properties in a tween; keep visibility in a separate set.
    gsap.set(items, { clearProps: 'all' });
    gsap.set(items, { opacity: 1 });
    for (const g of root.querySelectorAll('[data-mx]')) {
      gsap.set(g, { x: Number(g.getAttribute('data-mx')), y: Number(g.getAttribute('data-my')) });
    }
    const steps = Array.from(root.querySelectorAll('[data-step]'), (el) =>
      Number(el.getAttribute('data-step')),
    );
    opts.onStep?.(Math.max(1, ...steps));
    return () => {};
  }
  // Hide everything first, so nothing shows before its turn (e.g. while Yoyo flies over).
  items.forEach((el) => gsap.set(el, { opacity: 0 }));
  const tl = gsap.timeline({ delay: opts.delay ?? 0 });
  let at = 0,
    step = 0;
  const ends = new Map<Element, number>();
  const groupOf = (el: Element) => el.closest('[data-step]');
  for (const el of items) {
    // Steps build the drawing up like a whiteboard animation, with a pause between them.
    const s = Number(groupOf(el)?.getAttribute('data-step') ?? 0);
    if (s > step) {
      if (step > 0) at += opts.stepGap ?? 1.1;
      step = s;
      if (opts.onStep) tl.call(opts.onStep, [s], at);
    }
    if (el.classList.contains('ink-label') || el.classList.contains('dashed')) {
      gsap.set(el, { opacity: 0, scale: 0.86, transformOrigin: '50% 60%' });
      tl.to(
        el,
        { opacity: 1, scale: 1, duration: 0.28, ease: 'back.out(2.2)' },
        Math.max(0, at - 0.08),
      );
      at += 0.06;
      const g = el.closest('[data-mx]');
      if (g) ends.set(g, at);
      continue;
    }
    const path = el as SVGGeometryElement;
    const L = path.getTotalLength?.() ?? 0;
    if (!(L > 0)) continue;
    const dur = Math.min(0.85, Math.max(0.22, L / 900));
    gsap.set(path, { strokeDasharray: L, strokeDashoffset: L });
    tl.set(path, { opacity: 1 }, at);
    tl.to(path, { strokeDashoffset: 0, duration: dur, ease: penEase(path) }, at);
    at += dur * 0.85;
    const g = path.closest('[data-mx]');
    if (g) ends.set(g, at + dur * 0.15);
  }
  // Motion: once drawn, an element glides to where it was told to go.
  for (const [g, end] of ends) {
    const x = Number(g.getAttribute('data-mx')),
      y = Number(g.getAttribute('data-my'));
    tl.to(g, { x, y, duration: 1.1, ease: 'power2.inOut' }, end + 0.35);
  }
  if (opts.onStep && step === 0) opts.onStep(1);
  // Boil: re-pose the ink every few frames by a pixel or so (HyperFrames hwBoil "calm").
  const groups = Array.from(root.querySelectorAll<SVGGElement>('.boil'));
  let tick = 0;
  const boil = groups.length
    ? setInterval(() => {
        tick++;
        groups.forEach((g, i) =>
          gsap.set(g, {
            x: hash(tick * 3 + i * 97, 3) * 0.9,
            y: hash(tick * 3 + 1 + i * 97, 3) * 0.9,
            rotation: hash(tick * 3 + 2 + i * 97, 3) * 0.25,
            transformOrigin: '50% 50%',
          }),
        );
      }, 110)
    : undefined;
  return () => {
    tl.kill();
    clearInterval(boil);
  };
}
