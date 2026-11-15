import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGesture, type TrailPoint } from '../shared/gesture';
import type { Word } from '../shared/grounding';

const word = (text: string, x: number, y: number, line: number): Word => ({
  text,
  line,
  box: { x, y, width: 0.05, height: 0.02 },
});
const words = [
  word('Glucose', 0.1, 0.2, 0),
  word('enters', 0.16, 0.2, 0),
  word('glycolysis', 0.22, 0.2, 0),
  word('Pyruvate', 0.6, 0.6, 1),
  word('kinase', 0.66, 0.6, 1),
  word('step', 0.72, 0.6, 1),
];
/** A hand-drawn loop around a centre, with a wander in and out. */
function loop(cx: number, cy: number, rx: number, ry: number, turns = 1.1): TrailPoint[] {
  const pts: TrailPoint[] = [];
  let t = 0;
  for (let k = 0; k <= 10; k++) pts.push({ x: 0.9 - k * 0.02, y: 0.9 - k * 0.02, t: (t += 16) });
  for (let a = 0; a <= turns * 2 * Math.PI; a += 0.12)
    pts.push({
      x: cx + rx * Math.cos(a) * (1 + 0.04 * Math.sin(5 * a)),
      y: cy + ry * Math.sin(a),
      t: (t += 16),
    });
  for (let k = 0; k <= 6; k++) pts.push({ x: cx + rx + k * 0.01, y: cy + k * 0.01, t: (t += 16) });
  return pts;
}

test('circling words with the cursor picks out exactly those words', () => {
  const g = readGesture(loop(0.685, 0.61, 0.07, 0.035), words);
  assert.equal(g?.kind, 'circle');
  assert.equal(g!.quote, 'Pyruvate kinase step');
  assert.ok(g!.box.x >= 0.6 - 1e-9 && g!.box.x + g!.box.width <= 0.77 + 1e-9);
});

test('a loop around one word quotes just that word; a loop round empty space has no quote', () => {
  assert.equal(readGesture(loop(0.245, 0.21, 0.035, 0.03), words)?.quote, 'glycolysis');
  const empty = readGesture(loop(0.4, 0.8, 0.05, 0.04), words);
  assert.equal(empty?.kind, 'circle');
  assert.equal(empty!.quote, '');
});

test('moving to a word and resting there is pointing; a still or wandering cursor is nothing', () => {
  const pts: TrailPoint[] = [];
  let t = 0;
  for (let k = 0; k <= 20; k++) pts.push({ x: 0.3 + k * 0.012, y: 0.4 + k * 0.01, t: (t += 16) });
  for (let k = 0; k < 30; k++) pts.push({ x: 0.64, y: 0.61, t: (t += 16) });
  const g = readGesture(pts, words);
  assert.equal(g?.kind, 'point');
  assert.match(g!.quote, /Pyruvate kinase/);
  // Never moved: no gesture, even though the cursor rests on a word.
  const still = Array.from({ length: 40 }, (_, k) => ({ x: 0.62, y: 0.61, t: k * 16 }));
  assert.equal(readGesture(still, words), null);
  // Still moving at release: no gesture.
  const moving = Array.from({ length: 40 }, (_, k) => ({ x: 0.1 + k * 0.01, y: 0.5, t: k * 16 }));
  assert.equal(readGesture(moving, words), null);
  // A straight swipe is not a circle.
  const swipe = Array.from({ length: 60 }, (_, k) => ({ x: 0.1 + k * 0.012, y: 0.3, t: k * 16 }));
  assert.notEqual(readGesture(swipe, words)?.kind, 'circle');
});

test('a long trail is read quickly', () => {
  const pts: TrailPoint[] = [];
  for (let k = 0; k < 3000; k++)
    pts.push({ x: 0.5 + 0.3 * Math.sin(k / 37), y: 0.5 + 0.2 * Math.sin(k / 23), t: k * 16 });
  const at = performance.now();
  readGesture(pts, words);
  assert.ok(performance.now() - at < 400, 'under 400 ms');
});
