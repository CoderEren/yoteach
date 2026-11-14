import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFile } from 'node:fs/promises';
const pdf = await PDFDocument.create();
pdf.setTitle('yoteach sample: Introduction to metabolism');
pdf.setAuthor('yoteach');
const font = await pdf.embedFont(StandardFonts.Helvetica),
  bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const pages = [
  [
    'Introduction to metabolism',
    'A sample lecture for exploring your workspace.',
    [
      'Metabolism describes the chemical reactions that sustain life.',
      'Catabolic pathways break down molecules; anabolic pathways build them.',
      'These pathways connect through shared molecules and energy carriers.',
    ],
  ],
  [
    'Glycolysis: an overview',
    'One glucose molecule becomes two pyruvate molecules.',
    [
      'Glycolysis takes place in the cytosol.',
      'It includes an energy investment phase and an energy payoff phase.',
      'Per glucose, the net yield is two ATP and two NADH.',
    ],
  ],
  [
    'Energy investment phase',
    'An initial investment prepares glucose for later reactions.',
    [
      'Two ATP molecules are consumed in the early phase of glycolysis.',
      'Hexokinase transfers a phosphate from ATP to glucose.',
      'Phosphofructokinase-1 catalyzes a second ATP-consuming step.',
    ],
  ],
  [
    'Energy payoff phase',
    'Energy is captured as the three-carbon molecules are processed.',
    [
      'The payoff phase produces four ATP per original glucose molecule.',
      'Subtracting the two invested ATP gives a net gain of two ATP.',
      'Two NADH and two pyruvate are also produced per glucose.',
    ],
  ],
  [
    'Questions to carry forward',
    'Use your own topic notes to explore these questions.',
    [
      'What distinguishes a net yield from a gross yield?',
      'Why do pathways have regulated steps?',
      'How do the investment and payoff phases fit together?',
    ],
  ],
];
for (const [i, [title, subtitle, lines]] of pages.entries()) {
  const p = pdf.addPage([842, 595]);
  p.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: rgb(0.965, 0.973, 0.99) });
  p.drawText(title, { x: 58, y: 470, size: 30, font: bold, color: rgb(0.09, 0.13, 0.22) });
  p.drawText(subtitle, { x: 58, y: 425, size: 17, font, color: rgb(0.35, 0.4, 0.5) });
  for (const [j, line] of lines.entries())
    p.drawText(line, { x: 58, y: 340 - j * 45, size: 16, font, color: rgb(0.13, 0.17, 0.25) });
  p.drawLine({
    start: { x: 58, y: 88 },
    end: { x: 784, y: 88 },
    color: rgb(0.8, 0.82, 0.9),
    thickness: 1,
  });
  p.drawText('yoteach / Sample material - not an uploaded university lecture', {
    x: 58,
    y: 58,
    size: 11,
    font,
    color: rgb(0.4, 0.43, 0.52),
  });
  p.drawText(String(i + 1), { x: 775, y: 58, size: 11, font });
}
await writeFile('public/sample-lecture.pdf', await pdf.save());
