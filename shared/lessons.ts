import { z } from 'zod';

export const LessonKey = z.enum(['glucose-phosphorylation']);
export const LessonStep = z.number().int().min(1).max(6);
export const SavedLessonSchema = z.object({
  id: z.uuid(),
  key: LessonKey,
  revision: z.literal(1),
  step: LessonStep,
  sessionId: z.uuid().nullable(),
  source: z.object({ documentId: z.uuid(), page: z.number().int().positive() }).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SavedLesson = z.infer<typeof SavedLessonSchema>;
export type VisualStep = {
  title: string;
  text: string;
  scene: 'substrates' | 'enzyme' | 'transfer' | 'products' | 'retention' | 'balance';
  takeaway: string;
};
export type VisualLesson = {
  key: z.infer<typeof LessonKey>;
  title: string;
  subtitle: string;
  steps: VisualStep[];
  sources: { title: string; url: string }[];
};
// Authored scientific scenes, never model-generated executable code or molecular geometry.
export const glycolysis: VisualLesson = {
  key: 'glucose-phosphorylation',
  title: 'Why invest ATP in glucose?',
  subtitle: 'Glycolysis · the first phosphorylation',
  steps: [
    {
      title: 'Start with glucose and ATP',
      text: 'Glucose has six carbons. In the cytosol, the first reaction of glycolysis uses one ATP to phosphorylate glucose. This step consumes ATP; it does not make ATP.',
      scene: 'substrates',
      takeaway: 'An investment of one ATP in this reaction.',
    },
    {
      title: 'Hexokinase brings the partners together',
      text: 'Hexokinase catalyzes the reaction, with magnesium assisting ATP binding and phosphate transfer. The enzyme is reused; it is not consumed. It lowers the activation barrier, not the reaction’s overall free-energy change.',
      scene: 'enzyme',
      takeaway: 'A catalyst helps the reaction proceed.',
    },
    {
      title: 'Follow the terminal phosphate',
      text: 'The terminal phosphoryl group of ATP is transferred to the oxygen of glucose’s carbon-6 hydroxyl group. ATP becomes ADP. Scrub the diagram to follow the transfer; this is a schematic, not a molecular trajectory.',
      scene: 'transfer',
      takeaway: 'ATP supplies the phosphate added to glucose.',
    },
    {
      title: 'Meet the products',
      text: 'The products are glucose-6-phosphate and ADP. Coupling glucose phosphorylation to ATP conversion makes the overall reaction favorable under cellular conditions. Energy is not released simply by breaking a bond; the complete reaction matters.',
      scene: 'products',
      takeaway: 'Glucose + ATP → glucose-6-phosphate + ADP.',
    },
    {
      title: 'Retain and prepare the sugar',
      text: 'Phosphorylation helps retain glucose in the cell: glucose-6-phosphate is charged and is not transported out by glucose transporters. It can continue through glycolysis or enter other pathways, so this is not the committed step of glycolysis.',
      scene: 'retention',
      takeaway: 'Retained in the cell, with several possible routes.',
    },
    {
      title: 'Zoom out: investment and payoff',
      text: 'Per glucose, glycolysis invests two ATP: one here and one at phosphofructokinase-1. Later reactions produce four ATP, giving a net gain of two ATP. The pathway also produces two pyruvate and two NADH. The first reaction alone has no ATP payoff.',
      scene: 'balance',
      takeaway: '4 ATP produced − 2 ATP invested = 2 ATP net.',
    },
  ],
  sources: [
    {
      title: 'Chandel · Glycolysis (Cold Spring Harbor Perspectives in Biology)',
      url: 'https://cshperspectives.cshlp.org/content/13/5/a040535.full.pdf',
    },
    {
      title: 'Molecular Biology of the Cell · Catalysis and the Use of Energy by Cells',
      url: 'https://www.ncbi.nlm.nih.gov/books/NBK26838/',
    },
    {
      title: 'Molecular Biology of the Cell · How Cells Obtain Energy from Food',
      url: 'https://www.ncbi.nlm.nih.gov/books/NBK26882/',
    },
    {
      title: 'The Cell: A Molecular Approach · Metabolic Energy',
      url: 'https://www.ncbi.nlm.nih.gov/books/NBK9903/',
    },
  ],
};
export function lessonDefinition(key: z.infer<typeof LessonKey>): VisualLesson {
  LessonKey.parse(key);
  return glycolysis;
}
export function lessonContext(saved: SavedLesson) {
  const definition = lessonDefinition(saved.key);
  return {
    id: saved.id,
    lesson: definition.title,
    step: saved.step,
    total: definition.steps.length,
    ...definition.steps[saved.step - 1],
    schematic: true,
  };
}
