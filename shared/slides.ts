// How much teaching a lecture slide deserves, before (or without) the slide reader's verdict.
export type SlideKind = 'teach' | 'brief' | 'skip';
const filler =
  /\b(thank you|thanks|questions\??|any questions|agenda|outline|contents|overview|learning (objectives|outcomes)|references|bibliography|further reading|acknowledg|lecturer|professor|prof\.|dr\.|department|university|faculty|school of|copyright|all rights reserved)\b/i;
/** Quick guess from the slide's text alone; the slide reader's kind replaces it when ready. */
export function guessSlideKind(text: string, page: number, total: number): SlideKind {
  const words = text.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (words.length <= 3) return 'skip';
  if ((page === 1 || page === total) && words.length < 25) return 'skip';
  if (filler.test(text) && words.length < 40) return 'skip';
  if (words.length < 12) return 'brief';
  return 'teach';
}
/** What to tell the tutor to do with a slide of each kind. */
export function slideInstruction(kind: SlideKind, next: number | null) {
  const onward = next ? `navigate_slide to slide ${next}` : 'navigate_slide to the next slide';
  if (kind === 'skip')
    return `This slide has no teachable content (title, names, agenda, divider or thanks). Say at most one short sentence, or nothing, then call ${onward} straight away.`;
  if (kind === 'brief')
    return `This slide only introduces, recaps or states one simple point. Cover it in one or two sentences, then call ${onward}.`;
  return 'Teach this slide now from the supplied content: the central idea, how its parts relate, and an example if useful. Start with the idea itself, not with "This slide". Mark the slide as you speak by quoting its words in draw_on_screen, and show the process or mechanism behind it moving with sketch_on_screen; do not announce either. Then invite a question or offer the next slide.';
}
