import { z } from 'zod';

// Authored practice for the glucose-phosphorylation lesson. Misconceptions are a closed,
// sourced catalog; one is recorded only with evidence from the student's own answer.
export const MisconceptionId = z.enum([
  'atp-produced-first-step',
  'enzyme-consumed',
  'catalyst-changes-free-energy',
  'bond-breaking-releases-energy',
  'committed-step',
  'g6p-exported',
  'gross-as-net',
]);
export type MisconceptionId = z.infer<typeof MisconceptionId>;
export const misconceptions: Record<
  MisconceptionId,
  { description: string; correction: string; step: number }
> = {
  'atp-produced-first-step': {
    description: 'The first phosphorylation produces ATP.',
    correction: 'The first reaction consumes one ATP; ATP is produced later, in the payoff phase.',
    step: 1,
  },
  'enzyme-consumed': {
    description: 'Hexokinase is used up by the reaction.',
    correction: 'Hexokinase is a catalyst: it is released unchanged and can act again.',
    step: 2,
  },
  'catalyst-changes-free-energy': {
    description: 'The enzyme supplies energy or changes the overall free-energy change.',
    correction:
      'An enzyme lowers the activation barrier; it does not change the overall free-energy change.',
    step: 2,
  },
  'bond-breaking-releases-energy': {
    description: 'Breaking a phosphate bond by itself releases energy.',
    correction:
      'Breaking a bond requires energy. The favourable change comes from the whole coupled reaction.',
    step: 4,
  },
  'committed-step': {
    description: 'Glucose phosphorylation is the committed step of glycolysis.',
    correction:
      'Glucose-6-phosphate can enter several pathways; the committed step is at phosphofructokinase-1.',
    step: 5,
  },
  'g6p-exported': {
    description: 'Glucose-6-phosphate leaves the cell through glucose transporters.',
    correction:
      'Its charge keeps glucose-6-phosphate in the cell; glucose transporters do not export it.',
    step: 5,
  },
  'gross-as-net': {
    description: 'Glycolysis nets four ATP per glucose.',
    correction: 'Four ATP are produced, but two are invested, so the net gain is two ATP.',
    step: 6,
  },
};
export type Choice = {
  id: string;
  text: string;
  correct: boolean;
  feedback: string;
  misconception: MisconceptionId | null;
};
export type PracticeQuestion = {
  id: z.infer<typeof QuestionId>;
  step: number;
  prompt: string;
  choices: Choice[] | null;
  modelAnswer: string;
  rubric: string;
};
export const QuestionId = z.enum([
  'atp-first-step',
  'hexokinase-role',
  'energy-source',
  'g6p-fate',
  'net-atp',
  'why-invest',
]);
export type QuestionId = z.infer<typeof QuestionId>;
export const practice: PracticeQuestion[] = [
  {
    id: 'atp-first-step',
    step: 1,
    prompt: 'In the first reaction of glycolysis, what happens to ATP?',
    choices: [
      {
        id: 'consumed',
        text: 'One ATP is consumed; its terminal phosphate is transferred to glucose.',
        correct: true,
        feedback: 'Right. The first reaction invests one ATP, which becomes ADP.',
        misconception: null,
      },
      {
        id: 'produced',
        text: 'One ATP is produced as glucose is phosphorylated.',
        correct: false,
        feedback: 'This reaction uses ATP rather than making it.',
        misconception: 'atp-produced-first-step',
      },
      {
        id: 'unchanged',
        text: 'ATP only helps the enzyme bind and comes out unchanged.',
        correct: false,
        feedback: 'ATP does react: its terminal phosphate goes to glucose, leaving ADP.',
        misconception: null,
      },
    ],
    modelAnswer:
      'One ATP is consumed: its terminal phosphoryl group is transferred to glucose, forming glucose-6-phosphate and ADP.',
    rubric:
      'Correct: ATP is consumed/used/invested and becomes ADP or donates its phosphate. Incorrect: says ATP is produced or not involved.',
  },
  {
    id: 'hexokinase-role',
    step: 2,
    prompt: 'What does hexokinase do in this reaction?',
    choices: [
      {
        id: 'lowers-barrier',
        text: 'It speeds the reaction by lowering the activation barrier and is released unchanged.',
        correct: true,
        feedback: 'Right. It is a reusable catalyst; it does not change the overall energetics.',
        misconception: null,
      },
      {
        id: 'supplies-energy',
        text: 'It supplies the energy that makes the reaction favourable.',
        correct: false,
        feedback: 'Enzymes do not supply energy or change the overall free-energy change.',
        misconception: 'catalyst-changes-free-energy',
      },
      {
        id: 'consumed',
        text: 'It is used up as it joins the phosphate to glucose.',
        correct: false,
        feedback: 'Hexokinase is not consumed; it catalyzes reaction after reaction.',
        misconception: 'enzyme-consumed',
      },
    ],
    modelAnswer:
      'Hexokinase catalyzes the transfer: it brings glucose and Mg-ATP together and lowers the activation barrier. It is released unchanged and does not alter the overall free-energy change.',
    rubric:
      'Correct: catalyst / speeds up / lowers activation energy / not consumed. Incorrect: supplies energy, makes the reaction favourable, or is used up.',
  },
  {
    id: 'energy-source',
    step: 4,
    prompt:
      'Why is phosphorylating glucose with ATP favourable overall? Explain where the energy comes from.',
    choices: null,
    modelAnswer:
      'The coupled reaction glucose + ATP → glucose-6-phosphate + ADP has a negative free-energy change under cellular conditions: the products are lower in free energy than the reactants. Breaking a bond requires energy; the favourable change comes from the complete reaction, not from breaking ATP’s bond alone.',
    rubric:
      'Correct: the overall/coupled reaction (or products vs reactants) has a favourable/negative free-energy change. Partial: ATP provides the phosphate or energy, without the overall reaction. Flag bond-breaking-releases-energy only if the answer states that breaking a bond (e.g. ATP’s phosphate bond) itself releases energy.',
  },
  {
    id: 'g6p-fate',
    step: 5,
    prompt: 'Which statement about glucose-6-phosphate is correct?',
    choices: [
      {
        id: 'retained',
        text: 'Its charge keeps it in the cell, and it can continue into several pathways.',
        correct: true,
        feedback: 'Right. It is retained and still has more than one possible route.',
        misconception: null,
      },
      {
        id: 'committed',
        text: 'Forming it commits the glucose to glycolysis.',
        correct: false,
        feedback: 'It can still enter other pathways; this is not the committed step.',
        misconception: 'committed-step',
      },
      {
        id: 'exported',
        text: 'It leaves the cell through glucose transporters.',
        correct: false,
        feedback: 'Glucose transporters do not move glucose-6-phosphate out of the cell.',
        misconception: 'g6p-exported',
      },
    ],
    modelAnswer:
      'Glucose-6-phosphate is charged, so glucose transporters do not carry it out of the cell. It can continue through glycolysis or enter other pathways, so this is not the committed step.',
    rubric:
      'Correct: retained/trapped in the cell and/or can enter several pathways. Incorrect: committed to glycolysis, or exported.',
  },
  {
    id: 'net-atp',
    step: 6,
    prompt: 'Per glucose, what is the net ATP yield of glycolysis?',
    choices: [
      {
        id: 'two',
        text: 'Two ATP',
        correct: true,
        feedback: 'Right. Four produced minus two invested gives two net.',
        misconception: null,
      },
      {
        id: 'four',
        text: 'Four ATP',
        correct: false,
        feedback: 'Four is the total produced, before subtracting the two invested.',
        misconception: 'gross-as-net',
      },
      {
        id: 'minus-two',
        text: 'Minus two ATP',
        correct: false,
        feedback: 'That counts only the investment. The payoff phase produces four ATP.',
        misconception: null,
      },
    ],
    modelAnswer:
      'Two ATP net: two are invested (hexokinase and phosphofructokinase-1) and four are produced later.',
    rubric: 'Correct: two (net). Incorrect: four, or any other number.',
  },
  {
    id: 'why-invest',
    step: 6,
    prompt:
      'In your own words: why does a cell “invest” ATP at the start of glycolysis if it wants to make ATP?',
    choices: null,
    modelAnswer:
      'The early phosphorylations prepare the sugar: they keep glucose in the cell and activate it for later reactions. The payoff phase then produces four ATP, so the cell gains two ATP net per glucose.',
    rubric:
      'Correct: mentions preparing/activating or retaining the sugar AND a later net gain (or 4 produced vs 2 invested). Partial: only one of these. Flag gross-as-net if the answer says the net gain is four; atp-produced-first-step if it says the first step makes ATP; committed-step if it says the first phosphorylation commits glucose to glycolysis.',
  },
];
export function question(id: QuestionId) {
  return practice.find((q) => q.id === QuestionId.parse(id))!;
}
/** What the tutor and the student may see before answering; never the model answer. */
export function publicQuestion(q: PracticeQuestion) {
  return {
    question: q.id,
    step: q.step,
    prompt: q.prompt,
    choices: q.choices?.map((c) => c.text) ?? null,
  };
}
export const Verdict = z.enum(['correct', 'partial', 'incorrect']);
export const AnswerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('choice'), choiceId: z.string().min(1).max(40) }),
  z.object({ kind: z.literal('text'), text: z.string().trim().min(1).max(2000) }),
]);
export type Answer = z.infer<typeof AnswerSchema>;
export const AttemptSchema = z.object({
  id: z.uuid(),
  questionId: QuestionId,
  lessonId: z.uuid().nullable(),
  sessionId: z.uuid().nullable(),
  source: z.object({ documentId: z.uuid(), page: z.number().int().positive() }).nullable(),
  origin: z.enum(['student', 'tutor']),
  /** typed: entered in the app; transcript: matches the student's saved words; reported: the tutor's paraphrase. */
  answerSource: z.enum(['typed', 'transcript', 'reported']),
  answer: AnswerSchema,
  verdict: Verdict,
  feedback: z.string().min(1).max(2000),
  misconceptions: z
    .array(z.object({ id: MisconceptionId, evidence: z.string().min(1).max(400) }))
    .max(3),
  grader: z.enum(['authored', 'claude']),
  model: z.string().max(120).nullable(),
  createdAt: z.string().datetime(),
});
export type PracticeAttempt = z.infer<typeof AttemptSchema>;
export const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[“”"‘’'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
/** Deterministic grading for a chosen option; the evidence is the statement the student chose. */
export function gradeChoice(q: PracticeQuestion, choiceId: string) {
  const choice = q.choices?.find((c) => c.id === choiceId);
  if (!choice) throw new Error('Choose one of the listed answers.');
  return {
    verdict: choice.correct ? ('correct' as const) : ('incorrect' as const),
    feedback: choice.feedback,
    misconceptions: choice.misconception
      ? [{ id: choice.misconception, evidence: choice.text }]
      : [],
  };
}
/** Keep only catalog misconceptions whose evidence is an actual quote from the answer. */
export function groundMisconceptions(
  answer: string,
  found: { id: string; evidence: string }[],
): PracticeAttempt['misconceptions'] {
  const haystack = normalize(answer),
    seen = new Set<string>();
  return found.flatMap((m) => {
    const id = MisconceptionId.safeParse(m.id);
    const quote = normalize(m.evidence);
    if (!id.success || seen.has(id.data) || quote.length < 3 || !haystack.includes(quote))
      return [];
    seen.add(id.data);
    return [{ id: id.data, evidence: m.evidence.trim().slice(0, 400) }];
  });
}
export type ReviewSuggestion = {
  questionId: QuestionId;
  step: number;
  verdict: z.infer<typeof Verdict>;
  misconception: MisconceptionId | null;
  evidence: string | null;
  attemptId: string;
  at: string;
};
/**
 * Review comes only from the latest answer to each question. A later correct answer clears it.
 * No time, attendance or playback signal is used.
 */
export function reviewSuggestions(attempts: PracticeAttempt[]): ReviewSuggestion[] {
  const latest = new Map<string, PracticeAttempt>();
  for (const a of attempts)
    if (!latest.has(a.questionId) || latest.get(a.questionId)!.createdAt <= a.createdAt)
      latest.set(a.questionId, a);
  return [...latest.values()]
    .filter((a) => a.verdict !== 'correct')
    .flatMap((a): ReviewSuggestion[] => {
      const base = {
        questionId: a.questionId,
        verdict: a.verdict,
        attemptId: a.id,
        at: a.createdAt,
      };
      return a.misconceptions.length
        ? a.misconceptions.map((m) => ({
            ...base,
            step: misconceptions[m.id].step,
            misconception: m.id,
            evidence: m.evidence,
          }))
        : [{ ...base, step: question(a.questionId).step, misconception: null, evidence: null }];
    })
    .sort((x, y) => x.step - y.step);
}
