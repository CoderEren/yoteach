// On-device "are you stuck?" detection. Works only from text recognised locally; nothing is sent.
export type ScreenSample = { words: string[]; at: number };
/** How long a screen with this much text can reasonably hold attention before help helps. */
export function stuckAfterMs(wordCount: number) {
  return Math.min(360, Math.max(75, 45 + wordCount * 0.4)) * 1000;
}
/** Two screens are "the same" when most recognised words match (clocks and cursors may change). */
export function sameScreen(a: string[], b: string[]) {
  if (!a.length && !b.length) return true;
  const A = new Set(a),
    B = new Set(b);
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / Math.max(A.size, B.size, 1) >= 0.85;
}
/** Tracks dwell on one screen and says when to offer help, once per screen. */
export class StuckWatch {
  private words: string[] = [];
  private since: number | null = null;
  private offered = false;
  observe(words: string[], now: number): boolean {
    const normal = words
      .map((w) => w.toLowerCase())
      .filter((w) => /\p{L}/u.test(w))
      .slice(0, 600);
    if (this.since === null || !sameScreen(this.words, normal)) {
      this.words = normal;
      this.since = now;
      this.offered = false;
      return false;
    }
    if (this.offered || now - this.since < stuckAfterMs(normal.length)) return false;
    this.offered = true;
    return true;
  }
  /** The student acted (asked, changed screen, was away): start over. */
  reset() {
    this.since = null;
    this.offered = false;
  }
}
