import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { anchor, freeSpot, labelSpot, layoutForModel } from '../shared/grounding';
import { cleanSpeech } from '../shared/tutor';

// Words and lines recognised on-device from a recreated biochemistry slide (1512 × 982).
const ocr = JSON.parse(readFileSync('tests/fixtures/slide-ocr.json', 'utf8'));
const near = (box: any, x: number, y: number) =>
  Math.abs(box.x * 1512 - x) < 30 && Math.abs(box.y * 982 - y) < 30;

test('quotes snap to the recognised words, including Greek, hyphens and wrapped lines', () => {
  const k = anchor('β-ketothiolase', null, ocr.words, ocr.textBoxes)!;
  assert.equal(k.how, 'words');
  assert.ok(near(k.box, 1000, 330), 'β-ketothiolase sits where it is drawn');
  const wrapped = anchor(
    '3-Hydroxy-3-methylglutaryl CoA',
    { x: 0.7, y: 0.8, width: 0.2, height: 0.05 },
    ocr.words,
    ocr.textBoxes,
  )!;
  assert.equal(wrapped.parts.length, 2, 'one box per line');
  const synthase = anchor('HMG-CoA synthase', null, ocr.words, ocr.textBoxes)!;
  assert.ok(synthase.box.width < 0.25);
  // "Acetyl CoA" appears twice: the model's estimate chooses which one.
  const top = anchor(
    'Acetyl CoA',
    { x: 0.46, y: 0.24, width: 0.1, height: 0.03 },
    ocr.words,
    ocr.textBoxes,
  )!;
  const bottom = anchor(
    'Acetyl CoA',
    { x: 0.46, y: 0.48, width: 0.1, height: 0.03 },
    ocr.words,
    ocr.textBoxes,
  )!;
  assert.ok(top.box.y < bottom.box.y);
  assert.equal(anchor('photosynthesis in leaves', null, ocr.words, ocr.textBoxes), null);
  assert.match(layoutForModel(ocr.textBoxes), /^L0 \[x\d+ y\d+ w\d+ h\d+\] Condensation/);
});

test('labels and panels avoid text; voice tags never reach the reader', () => {
  const text = ocr.textBoxes.map((t: any) => t.box);
  const k = anchor('β-ketothiolase', null, ocr.words, ocr.textBoxes)!;
  const label = labelSpot(k.box, { width: 0.1, height: 0.03 }, text);
  const overlap = (a: any, b: any) =>
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  assert.equal(
    text.reduce((s: number, b: any) => s + overlap(label, b), 0),
    0,
  );
  const panel = freeSpot({ width: 0.3, height: 0.3 }, text);
  assert.ok(text.reduce((s: number, b: any) => s + overlap(panel, b), 0) < 0.002);
  assert.equal(
    cleanSpeech(
      '[happy] Cholesterol synthesis starts by putting small [accent] two-carbon blocks together!',
    ),
    'Cholesterol synthesis starts by putting small two-carbon blocks together!',
  );
  assert.equal(cleanSpeech('Use [1, 2] as indices.'), 'Use [1, 2] as indices.');
  assert.equal(cleanSpeech('the drug [/slow] by opening its ring'), 'the drug by opening its ring');
});

test('quotes resolve on PDF slides from text runs alone', async () => {
  const { wordsOf } = await import('../shared/grounding');
  const slide = {
    textBoxes: [
      {
        text: 'Beta-lactams bind penicillin-binding proteins',
        box: { x: 0.1, y: 0.3, width: 0.6, height: 0.05 },
      },
      {
        text: 'Blocking cross-linking weakens the cell wall',
        box: { x: 0.1, y: 0.4, width: 0.55, height: 0.05 },
      },
    ],
  };
  const words = wordsOf(slide);
  assert.equal(words.length, 10);
  const hit = anchor('weakens the cell wall', null, words, slide.textBoxes)!;
  assert.equal(hit.how, 'words');
  assert.ok(
    hit.box.x > 0.3 && hit.box.x + hit.box.width <= 0.651,
    'only the quoted part of the line',
  );
  assert.ok(Math.abs(hit.box.y - 0.4) < 1e-9);
});

test('visual descriptions and incomplete quotes never snap to loosely related OCR text', () => {
  const lines = [
    {
      text: 'locally released signalling molecule acts on nearby cells',
      box: { x: 0.2, y: 0.12, width: 0.5, height: 0.02 },
    },
  ];
  assert.equal(anchor('nearby cells release molecule', null, [], lines), null);
  assert.equal(anchor('molecule acts on distant cells', null, [], lines), null);
  assert.deepEqual(anchor('acts on nearby cells', null, [], lines)?.box, lines[0].box);
});
