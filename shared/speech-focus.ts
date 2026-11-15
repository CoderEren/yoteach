/**
 * Follow the voice: decide which region on screen Yoyo is talking about right now, from the
 * words it has just spoken. Used to walk Yoyo to that part and point at it while it explains,
 * instead of touring every mark on a timer.
 */
const STOP = new Set(
  (
    'the a an and or but if then than so of to in on at by for from with into onto over under ' +
    'is are was were be been being am do does did done has have had having it its this that ' +
    'these those there here what which who whom whose when where why how not no yes you your ' +
    'we our us they them their he she his her i me my mine can could will would should may ' +
    'might must shall just also very really quite about like as up down out off again more ' +
    'most some any each every all both few many much such only own same too now one two let ' +
    'lets see look looking get got going gonna make makes made thing things way part bit okay ' +
    'right well actually basically kind sort'
  ).split(' '),
);
export function normalizeWord(word: string) {
  let w = word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 4 && w.endsWith('es') && /(ss|sh|ch|x)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}
export function keywords(text: string, cap = 10) {
  const out: string[] = [];
  for (const raw of text.split(/\s+/)) {
    const w = normalizeWord(raw);
    if (w.length < 2 || STOP.has(w) || (w.length < 3 && !/\d/.test(w))) continue;
    if (!out.includes(w)) out.push(w);
    if (out.length >= cap) break;
  }
  return out;
}
export type FocusCandidate = {
  id: string;
  /** Short name of the part (a mark or region label). */
  label: string;
  /** The quoted words or description behind it. */
  evidence: string;
  /** Already drawn on screen: preferred over regions only known from the screen map. */
  drawn: boolean;
};
/** The candidate the recent speech is about, or null when nothing is clearly named. */
export function matchSpoken(heard: string[], candidates: FocusCandidate[]): string | null {
  const said = new Set(heard.map(normalizeWord).filter(Boolean));
  if (!said.size) return null;
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    const lk = keywords(c.label, 6);
    const ek = keywords(c.evidence, 12).filter((w) => !lk.includes(w));
    const lm = lk.filter((w) => said.has(w)).length,
      em = ek.filter((w) => said.has(w)).length;
    const ok =
      (lk.length > 0 && lm >= Math.min(2, lk.length)) ||
      lm + em >= 3 ||
      (lk.length === 0 && ek.length > 0 && em >= Math.min(2, ek.length));
    if (!ok) continue;
    const total = lk.length + ek.length || 1;
    const score = lm * 2 + em + (lm + em) / total + (c.drawn ? 0.5 : 0);
    if (!best || score > best.score) best = { id: c.id, score };
  }
  return best?.id ?? null;
}
