// Spatial grounding: tie what the model quotes to where the words really are on screen.
// The model's own coordinates are only a hint for choosing between repeated phrases.
export type Box = { x: number; y: number; width: number; height: number };
export type Word = { text: string; box: Box; line: number };
export type Line = { text: string; box: Box };

// Text recognition reads Greek letters as Latin lookalikes (β → B); match them the same way.
const lookalike: Record<string, string> = {
  α: 'a',
  β: 'b',
  γ: 'y',
  δ: 'd',
  ε: 'e',
  κ: 'k',
  μ: 'u',
  ν: 'v',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  χ: 'x',
};
const token = (s: string) =>
  s
    .toLowerCase()
    .replace(/[α-ω]/g, (c) => lookalike[c] ?? c)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
/** Words split at any non-letter/digit, so "HMG-CoA" and OCR's "HMG", "CoA" line up. */
export const tokens = (s: string) =>
  token(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
export function union(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.width)),
    bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: r - x, height: bottom - y };
}
const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const distance = (a: Box, b: Box) => {
  const p = centre(a),
    q = centre(b);
  return Math.hypot(p.x - q.x, p.y - q.y);
};
/**
 * Find the quoted phrase among recognised words (consecutive in reading order, tolerant of
 * punctuation and case). Repeated phrases resolve to the one nearest the model's estimate.
 * Falls back to the best-matching line when at least 60% of the quote's words appear in it.
 */
export function anchor(
  evidence: string,
  estimate: Box | null,
  words: Word[],
  lines: Line[],
): { box: Box; parts: Box[]; how: 'words' | 'line' } | null {
  const want = tokens(evidence);
  if (!want.length) return null;
  // Recognised words can themselves contain hyphens; expand them to the same pieces.
  const pieces: { t: string; w: number }[] = [];
  words.forEach((w, i) => tokens(w.text).forEach((t) => pieces.push({ t, w: i })));
  const said = pieces.map((p) => p.t);
  const hits: { box: Box; parts: Box[] }[] = [];
  for (let i = 0; i < said.length; i++) {
    if (said[i] !== want[0]) continue;
    let j = 0,
      k = i;
    const used: number[] = [];
    while (k < said.length && j < want.length) {
      if (!said[k]) {
        k++;
        continue;
      }
      if (said[k] !== want[j]) break;
      used.push(pieces[k].w);
      j++;
      k++;
    }
    // A phrase may wrap onto the next line, but not jump across the screen.
    if (j === want.length && new Set(used.map((u) => words[u].line)).size <= 3) {
      const ids = [...new Set(used)];
      // One box per line, so highlights and underlines follow wrapped text.
      const byLine = new Map<number, Box[]>();
      for (const u of ids)
        byLine.set(words[u].line, [...(byLine.get(words[u].line) ?? []), words[u].box]);
      hits.push({
        box: union(ids.map((u) => words[u].box)),
        parts: [...byLine.values()].map(union),
      });
    }
  }
  const nearest = <T extends { box: Box }>(items: T[]) =>
    estimate
      ? [...items].sort((a, b) => distance(a.box, estimate) - distance(b.box, estimate))[0]
      : items[0];
  if (hits.length && (hits.length === 1 || estimate)) return { ...nearest(hits), how: 'words' };
  if (hits.length > 1) return null; // ambiguous without a hint
  const scored = lines
    .map((l) => {
      const have = new Set(tokens(l.text));
      return { l, score: want.filter((w) => have.has(w)).length / want.length };
    })
    .filter((s) => s.score >= 0.6);
  if (!scored.length) return null;
  const top = Math.max(...scored.map((s) => s.score));
  const best = scored.filter((s) => s.score === top).map((s) => ({ box: s.l.box }));
  if (best.length > 1 && !estimate) return null;
  const pick = nearest(best).box;
  return { box: pick, parts: [pick], how: 'line' };
}
/** Compact layout for the model: numbered text lines with rounded positions (percent). */
export function layoutForModel(lines: Line[], limit = 220) {
  return lines
    .slice(0, limit)
    .map(
      (l, i) =>
        `L${i} [x${Math.round(l.box.x * 100)} y${Math.round(l.box.y * 100)} w${Math.round(l.box.width * 100)} h${Math.max(1, Math.round(l.box.height * 100))}] ${l.text.slice(0, 160)}`,
    )
    .join('\n');
}
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
/**
 * Where to put something of a given size so it covers as little text and as few marks as
 * possible. Scans a grid of candidate positions; earlier candidates win ties.
 */
export function freeSpot(size: { width: number; height: number }, avoid: Box[], prefer?: Box): Box {
  const w = Math.min(0.96, size.width),
    h = Math.min(0.92, size.height);
  let best: { box: Box; cost: number } | null = null;
  for (let gy = 0; gy <= 10; gy++)
    for (let gx = 0; gx <= 10; gx++) {
      const box = {
        x: 0.02 + ((0.96 - w) * gx) / 10,
        y: 0.06 + ((0.9 - h) * gy) / 10,
        width: w,
        height: h,
      };
      let cost = avoid.reduce((sum, a) => sum + overlap(box, a), 0);
      if (prefer) cost += distance(box, prefer) * 0.002;
      if (!best || cost < best.cost - 1e-9) best = { box, cost };
    }
  return best!.box;
}
/** Place a short label beside a mark without covering text or other labels. */
export function labelSpot(
  target: Box,
  size: { width: number; height: number },
  avoid: Box[],
  pad = { x: 0.012, y: 0.014 },
): Box {
  // Clear the drawn stroke around the mark, not just the words.
  const mark = {
    x: target.x - pad.x,
    y: target.y - pad.y,
    width: target.width + 2 * pad.x,
    height: target.height + 2 * pad.y,
  };
  const gap = 0.006;
  const candidates: Box[] = [
    { x: mark.x + mark.width + gap, y: mark.y + mark.height / 2 - size.height / 2 },
    { x: mark.x - gap - size.width, y: mark.y + mark.height / 2 - size.height / 2 },
    { x: mark.x + mark.width / 2 - size.width / 2, y: mark.y - gap - size.height },
    { x: mark.x + mark.width / 2 - size.width / 2, y: mark.y + mark.height + gap },
    { x: mark.x + mark.width + gap, y: mark.y - gap - size.height },
    { x: mark.x - gap - size.width, y: mark.y + mark.height + gap },
  ].map((p) => ({ ...p, width: size.width, height: size.height }));
  const inside = (b: Box) => b.x >= 0 && b.y >= 0 && b.x + b.width <= 1 && b.y + b.height <= 1;
  let best = candidates[0],
    cost = Infinity;
  for (const c of candidates) {
    const penalty = (inside(c) ? 0 : 1) + avoid.reduce((s, a) => s + overlap(c, a), 0) * 400;
    if (penalty < cost) {
      cost = penalty;
      best = c;
    }
  }
  return best;
}

/**
 * Word boxes for a snapshot: recognised words for screens; for PDF slides, words spread across
 * each text run in proportion to their characters (runs are single lines of PDF text).
 */
export function wordsOf(snapshot: { words?: Word[]; textBoxes: Line[] }): Word[] {
  if (snapshot.words?.length) return snapshot.words;
  const out: Word[] = [];
  snapshot.textBoxes.forEach((run, line) => {
    const text = run.text;
    const total = text.length || 1;
    for (const m of text.matchAll(/\S+/g)) {
      const start = m.index ?? 0;
      out.push({
        text: m[0],
        line,
        box: {
          x: run.box.x + (run.box.width * start) / total,
          y: run.box.y,
          width: (run.box.width * m[0].length) / total,
          height: run.box.height,
        },
      });
    }
  });
  return out;
}
