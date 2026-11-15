// Reading the student's cursor while they hold the talk key: a loop drawn around something
// means "this", and a cursor that travels and then rests is pointing at something.
// Coordinates are normalised to the display (0–1, top-left origin), like recognised words.
import { union, type Box, type Word } from './grounding';

export type TrailPoint = { x: number; y: number; t: number };
export type Gesture =
  | { kind: 'circle'; box: Box; quote: string; loop: [number, number][] }
  | { kind: 'point'; box: Box; quote: string; at: [number, number] };

/** Distance with the display's aspect ratio, so circles on a wide screen read as circles. */
const dist = (a: TrailPoint, b: TrailPoint, aspect: number) =>
  Math.hypot((a.x - b.x) * aspect, a.y - b.y);

/** Drop points closer than `gap` to the last kept one, so jitter does not count as drawing. */
export function simplify(points: TrailPoint[], aspect = 1.6, gap = 0.004) {
  const out: TrailPoint[] = [];
  for (const p of points) if (!out.length || dist(out.at(-1)!, p, aspect) >= gap) out.push(p);
  return out;
}

function inside(x: number, y: number, poly: [number, number][]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Words in reading order, joined and trimmed to a quotable length. */
function quoteOf(words: Word[]) {
  const sorted = [...words].sort((a, b) => a.line - b.line || a.box.x - b.box.x);
  const out: string[] = [];
  for (const w of sorted) {
    if (out.join(' ').length + w.text.length > 140) break;
    out.push(w.text);
  }
  return out.join(' ');
}

/**
 * The loop with the most travel that turns at least ~1.3π and (nearly) closes back on itself. Lets the
 * student wander to the spot first and wander off after; only the loop counts.
 */
function findLoop(p: TrailPoint[], aspect: number) {
  const n = p.length;
  if (n < 8) return null;
  const along = [0];
  for (let i = 1; i < n; i++) along.push(along[i - 1] + dist(p[i - 1], p[i], aspect));
  const heading = (i: number) => Math.atan2(p[i + 1].y - p[i].y, (p[i + 1].x - p[i].x) * aspect);
  let best: { i: number; j: number; travel: number } | null = null;
  for (let i = 0; i < n - 6; i++) {
    let turn = 0,
      x0 = Math.min(p[i].x, p[i + 1].x),
      x1 = Math.max(p[i].x, p[i + 1].x),
      y0 = Math.min(p[i].y, p[i + 1].y),
      y1 = Math.max(p[i].y, p[i + 1].y);
    for (let j = i + 2; j < n; j++) {
      x0 = Math.min(x0, p[j].x);
      x1 = Math.max(x1, p[j].x);
      y0 = Math.min(y0, p[j].y);
      y1 = Math.max(y1, p[j].y);
      if (j - 1 > i) {
        let d = heading(j - 1) - heading(j - 2);
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        turn += d;
      }
      const travel = along[j] - along[i];
      if (travel < 0.05) continue;
      const w = (x1 - x0) * aspect,
        h = y1 - y0;
      const size = Math.max(w, h);
      if (Math.min(w, h) < 0.012) continue; // a line, not a loop
      // Hand-drawn loops rarely close exactly or turn a full circle.
      const closes = dist(p[i], p[j], aspect) <= Math.max(0.03, size * 0.5);
      if (closes && Math.abs(turn) >= 1.3 * Math.PI && (!best || travel > best.travel))
        best = { i, j, travel };
    }
  }
  return best;
}

/**
 * What the cursor did during a hold, against the recognised words of the screen captured for
 * it. Null when the cursor did nothing deliberate.
 */
export function readGesture(raw: TrailPoint[], words: Word[], aspect = 1.6): Gesture | null {
  const p = simplify(raw, aspect).slice(-400);
  if (p.length < 2) return null;
  const loop = findLoop(p, aspect);
  if (loop) {
    const poly = p.slice(loop.i, loop.j + 1).map((q) => [q.x, q.y] as [number, number]);
    const xs = poly.map((q) => q[0]),
      ys = poly.map((q) => q[1]);
    const area = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
    const within = words.filter((w) =>
      inside(w.box.x + w.box.width / 2, w.box.y + w.box.height / 2, poly),
    );
    return {
      kind: 'circle',
      box: within.length ? union(within.map((w) => w.box)) : area,
      quote: quoteOf(within),
      loop: poly,
    };
  }
  // Pointing: the cursor travelled, then came to rest for a moment before release.
  let travel = 0;
  for (let i = 1; i < p.length; i++) travel += dist(p[i - 1], p[i], aspect);
  const last = raw.at(-1)!;
  const settled = raw.filter((q) => q.t >= last.t - 350);
  const still =
    settled.length > 0 &&
    last.t - settled[0].t >= 250 &&
    settled.every((q) => dist(q, last, aspect) < 0.01);
  if (travel < 0.04 || !still) return null;
  const near = words
    .map((w) => {
      const dx = Math.max(w.box.x - last.x, 0, last.x - (w.box.x + w.box.width)) * aspect,
        dy = Math.max(w.box.y - last.y, 0, last.y - (w.box.y + w.box.height));
      return { w, d: Math.hypot(dx, dy) };
    })
    .filter((c) => c.d < 0.025)
    .sort((a, b) => a.d - b.d)[0];
  if (!near) {
    const r = 0.03;
    return {
      kind: 'point',
      at: [last.x, last.y],
      quote: '',
      box: { x: last.x - r / aspect, y: last.y - r, width: (2 * r) / aspect, height: 2 * r },
    };
  }
  // The pointed word with its neighbours on the same line, for a quote the model can find.
  const line = words.filter((w) => w.line === near.w.line).sort((a, b) => a.box.x - b.box.x);
  const k = line.indexOf(near.w);
  const span = line.slice(Math.max(0, k - 2), k + 3);
  return {
    kind: 'point',
    at: [last.x, last.y],
    quote: quoteOf(span),
    box: near.w.box,
  };
}
