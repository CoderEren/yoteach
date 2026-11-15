/**
 * Subtitles for Yoyo's voice. Words are revealed as the audio plays (from the voice SDK's
 * per-character timings) and grouped into short phrases of a few words.
 */
export type Alignment = { chars: string[]; char_start_times_ms: number[] };
export type TimedWord = { word: string; at: number };

/** Words and when each starts, relative to the chunk start. Voice tags like [warmly] are dropped. */
export function alignedWords(alignment: Alignment): TimedWord[] {
  const out: TimedWord[] = [];
  let word = '',
    at = 0,
    tag = 0;
  const flush = () => {
    if (word) out.push({ word, at });
    word = '';
  };
  alignment.chars.forEach((ch, i) => {
    if (ch === '[') {
      flush();
      tag++;
      return;
    }
    if (ch === ']') {
      tag = Math.max(0, tag - 1);
      return;
    }
    if (tag) return;
    if (/\s/.test(ch)) return flush();
    if (!word) at = Math.max(0, alignment.char_start_times_ms[i] ?? 0);
    word += ch;
  });
  flush();
  return out;
}

/** Plain words of a full response (for pacing when no timings arrive), tags dropped. */
export function plainWords(text: string) {
  return text
    .replace(/\[[^\]]{0,40}\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const MAX_WORDS = 7;
/** Whether the next word starts a new phrase after `phrase`. */
export function startsNewPhrase(phrase: string[]) {
  if (!phrase.length) return false;
  const last = phrase[phrase.length - 1];
  if (/[.!?…:;]["')\]]?$/.test(last)) return true;
  if (/[,—–]["')\]]?$/.test(last) && phrase.length >= 3) return true;
  return phrase.length >= MAX_WORDS;
}

/**
 * Schedules words and reports the current phrase. `send(caption, word)` is called for every
 * word spoken, and with ('', '') when the subtitle clears.
 */
export class Captioner {
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private phrase: string[] = [];
  private clearTimer?: ReturnType<typeof setTimeout>;
  private fallback?: ReturnType<typeof setTimeout>;
  /** Timings arrived at least once: the agent sends them, so never guess the pace. */
  private aligned = false;
  constructor(
    private send: (caption: string, word: string) => void,
    private wordMs = 340,
  ) {}
  private later(fn: () => void, ms: number) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }
  private say(word: string) {
    clearTimeout(this.clearTimer);
    if (startsNewPhrase(this.phrase)) this.phrase = [];
    this.phrase.push(word);
    this.send(this.phrase.join(' '), word);
  }
  /** An audio chunk starts playing now. */
  chunk(alignment: Alignment) {
    this.aligned = true;
    clearTimeout(this.fallback);
    for (const w of alignedWords(alignment)) this.later(() => this.say(w.word), w.at);
  }
  /**
   * The text of a spoken response. Only used when the voice sends no timings: words are paced
   * at a speaking rate, starting shortly after, unless timings turn up first.
   */
  response(text: string) {
    if (this.aligned) return;
    const words = plainWords(text);
    clearTimeout(this.fallback);
    this.fallback = setTimeout(() => {
      if (this.aligned) return;
      words.forEach((w, i) => this.later(() => this.say(w), i * this.wordMs));
    }, 250);
  }
  /** The voice finished: keep the last phrase up briefly so it can be read. */
  finished(lingerMs = 1400) {
    clearTimeout(this.clearTimer);
    this.clearTimer = setTimeout(() => {
      if (this.timers.size) return this.finished(lingerMs); // more words are still due
      this.phrase = [];
      this.send('', '');
    }, lingerMs);
  }
  /** Interrupted, or the student started talking: drop everything now. */
  stop() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    clearTimeout(this.fallback);
    clearTimeout(this.clearTimer);
    if (this.phrase.length) this.send('', '');
    this.phrase = [];
  }
  /** A new conversation: timings may or may not arrive this time. */
  reset() {
    this.stop();
    this.aligned = false;
  }
}
