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
/** Below this many recognised words (a full-screen video or photo) there is nothing to be stuck on. */
export const MIN_WORDS = 5;
export class StuckWatch {
  constructor(private after: (wordCount: number) => number = stuckAfterMs) {}
  private words: string[] = [];
  private since: number | null = null;
  private offered = false;
  /** `canOffer: false` keeps tracking the screen without using up the one offer. */
  observe(words: string[], now: number, canOffer = true): boolean {
    const normal = words
      .map((w) => w.toLowerCase())
      .filter((w) => /\p{L}/u.test(w))
      .slice(0, 600);
    if (normal.length < MIN_WORDS) {
      this.reset();
      return false;
    }
    if (this.since === null || !sameScreen(this.words, normal)) {
      this.words = normal;
      this.since = now;
      this.offered = false;
      return false;
    }
    if (!canOffer || this.offered || now - this.since < this.after(normal.length)) return false;
    this.offered = true;
    return true;
  }
  /** The student acted (asked, changed screen, was away): start over. */
  reset() {
    this.since = null;
    this.offered = false;
  }
}
