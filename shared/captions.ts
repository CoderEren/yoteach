/**
 * Subtitles for Yoyo's voice. Words are revealed as the audio plays (from the voice SDK's
 * per-character timings) and grouped into short phrases of a few words.
 *
 * The voice arrives in audio chunks that do not respect word boundaries: "glu" can end one
 * chunk and "cose" start the next. Words are only shown whole, punctuation stays attached to
 * its word, and words always appear in spoken order.
 */
export type Alignment = { chars: string[]; char_start_times_ms: number[] };
export type TimedWord = {
  word: string;
  at: number;
  /** Glued to the previous word without a space: punctuation, or the rest of a split word. */
  join: boolean;
};
/** Reading state that carries from one chunk to the next. */
export type ReadState = { tag: number; open: boolean };

const ATTACHES = /^[.,!?;:…%)\]}'"”’»]+$/;

/**
 * Words and when each starts, relative to the chunk start. Voice tags like [warmly] are
 * dropped, even when split across chunks. `state.open` says the chunk ended inside a word.
 */
export function alignedWords(
  alignment: Alignment,
  state: ReadState = { tag: 0, open: false },
): TimedWord[] {
  const out: TimedWord[] = [];
  let word = '',
    at = 0,
    join = false,
    continuing = state.open;
  const flush = () => {
    if (word) out.push({ word, at, join: join || ATTACHES.test(word) });
    word = '';
    join = false;
  };
  alignment.chars.forEach((entry, i) => {
    const time = Math.max(0, alignment.char_start_times_ms[i] ?? 0);
    for (const ch of entry) {
      if (ch === '[') {
        flush();
        continuing = false;
        state.tag++;
        continue;
      }
      if (ch === ']') {
        state.tag = Math.max(0, state.tag - 1);
        continue;
      }
      if (state.tag) continue;
      if (/\s/.test(ch)) {
        flush();
        continuing = false;
        continue;
      }
      if (!word) {
        at = time;
        join = continuing;
        continuing = false;
      }
      word += ch;
    }
  });
  // A word that ends in punctuation is complete; anything else may go on in the next chunk.
  state.open = !!word && !state.tag && !/[.,!?;:…]$/.test(word);
  flush();
  return out;
}

/** Plain words of a full response (for pacing when no timings arrive), tags dropped. */
export function plainWords(text: string) {
  return text
    .replace(/\[[^\]]{0,40}\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .reduce<string[]>((words, w) => {
      if (ATTACHES.test(w) && words.length) words[words.length - 1] += w;
      else words.push(w);
      return words;
    }, []);
}

const MAX_WORDS = 7;
/** Whether the next word starts a new phrase after `phrase`. */
export function startsNewPhrase(phrase: string[]) {
  if (!phrase.length) return false;
  const last = phrase[phrase.length - 1];
  if (/[.!?…:;]["')\]”’]?$/.test(last)) return true;
  if (/[,—–]["')\]”’]?$/.test(last) && phrase.length >= 3) return true;
  return phrase.length >= MAX_WORDS;
}

/**
 * Schedules words and reports the current phrase. `send(caption, word)` is called for every
 * word spoken, and with ('', '') when the subtitle clears.
 */
export class Captioner {
  private timers = new Set<ReturnType<typeof setTimeout>>();
  /** Words due, in spoken order. A timer releases its word and everything before it. */
  private queue: { word: string; join: boolean }[] = [];
  /** The last word of a chunk, held back in case the next chunk finishes it. */
  private held: { word: string; join: boolean } | null = null;
  private heldTimer?: ReturnType<typeof setTimeout>;
  private read: ReadState = { tag: 0, open: false };
  private phrase: string[] = [];
  private clearTimer?: ReturnType<typeof setTimeout>;
  private fallback?: ReturnType<typeof setTimeout>;
  /** Timings arrived at least once: the agent sends them, so never guess the pace. */
  private aligned = false;
  constructor(
    private send: (caption: string, word: string) => void,
    private wordMs = 340,
  ) {}
  private schedule(item: { word: string; join: boolean }, ms: number) {
    this.queue.push(item);
    const t = setTimeout(() => {
      this.timers.delete(t);
      const upTo = this.queue.indexOf(item);
      if (upTo < 0) return; // already released by an earlier timer
      for (const next of this.queue.splice(0, upTo + 1)) this.say(next.word, next.join);
    }, ms);
    this.timers.add(t);
  }
  private say(word: string, join = false) {
    clearTimeout(this.clearTimer);
    if (join && this.phrase.length) {
      this.phrase[this.phrase.length - 1] += word;
    } else {
      if (startsNewPhrase(this.phrase)) this.phrase = [];
      this.phrase.push(word);
    }
    this.send(this.phrase.join(' '), this.phrase[this.phrase.length - 1]);
  }
  /** Show the held-back word now (its continuation is not coming). */
  private releaseHeld() {
    clearTimeout(this.heldTimer);
    const held = this.held;
    this.held = null;
    if (!held) return;
    for (const next of this.queue.splice(0)) this.say(next.word, next.join);
    this.say(held.word, held.join);
  }
  private cancelPending() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.queue = [];
    clearTimeout(this.heldTimer);
    this.held = null;
    this.read = { tag: 0, open: false };
  }
  /** An audio chunk starts playing now. */
  chunk(alignment: Alignment) {
    clearTimeout(this.fallback);
    if (!this.aligned) {
      // Words paced from the text before timings arrived would interleave: drop them.
      this.cancelPending();
      this.phrase = [];
    }
    this.aligned = true;
    const words = alignedWords(alignment, this.read);
    if (this.held) {
      clearTimeout(this.heldTimer);
      const held = this.held;
      this.held = null;
      if (words[0]?.join && !ATTACHES.test(words[0].word))
        words[0] = { ...words[0], word: held.word + words[0].word, join: held.join, at: 0 };
      else this.schedule(held, 0);
    }
    const last = this.read.open ? words.pop() : undefined;
    for (const w of words) this.schedule({ word: w.word, join: w.join }, w.at);
    if (last) {
      // Wait for the next chunk to finish the word, but never longer than a short pause.
      this.held = { word: last.word, join: last.join };
      this.heldTimer = setTimeout(() => this.releaseHeld(), last.at + 700);
    }
  }
  /**
   * The text of a spoken response. Only used when the voice sends no timings: words are paced
   * at a speaking rate, starting once the audio has had time to begin, unless timings turn up.
   */
  response(text: string) {
    if (this.aligned) return;
    const words = plainWords(text);
    clearTimeout(this.fallback);
    this.fallback = setTimeout(() => {
      if (this.aligned) return;
      words.forEach((w, i) => this.schedule({ word: w, join: false }, i * this.wordMs));
    }, 900);
  }
  /** The voice finished: keep the last phrase up briefly so it can be read. */
  finished(lingerMs = 1400) {
    // Playback can run dry mid-sentence, so a split word may still be finished afterwards.
    this.releaseHeld();
    clearTimeout(this.clearTimer);
    this.clearTimer = setTimeout(() => {
      if (this.timers.size) return this.finished(lingerMs); // more words are still due
      this.phrase = [];
      this.send('', '');
    }, lingerMs);
  }
  /** Interrupted, or the student started talking: drop everything now. */
  stop() {
    this.cancelPending();
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
