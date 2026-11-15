import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../electron/store';
import { Providers } from '../electron/providers';
import { TutorService } from '../electron/tutor';
import { guessSlideKind, slideInstruction } from '../shared/slides';

test('filler slides are recognised from their text before the slide reader answers', () => {
  assert.equal(
    guessSlideKind('Antimicrobial Therapies Dr. Jane Smith Department of Biochemistry', 1, 30),
    'skip',
  );
  assert.equal(guessSlideKind('Thank you! Questions?', 30, 30), 'skip');
  assert.equal(
    guessSlideKind('Learning objectives: mechanisms, resistance, dosing', 2, 30),
    'skip',
  );
  assert.equal(guessSlideKind('Part 2: Beta-lactams', 9, 30), 'skip');
  assert.equal(
    guessSlideKind('Summary: beta-lactams weaken the bacterial cell wall', 12, 30),
    'brief',
  );
  assert.equal(
    guessSlideKind(
      'Beta-lactams bind penicillin-binding proteins and block transpeptidation, weakening the peptidoglycan wall so the bacterium lyses under osmotic pressure.',
      10,
      30,
    ),
    'teach',
  );
  assert.match(slideInstruction('skip', 5), /navigate_slide to slide 5 straight away/);
  assert.match(slideInstruction('teach', null), /Teach this slide now/);
});

test('slides are read ahead once, then briefed instantly with marks on the shown slide', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-slides-'));
  try {
    const store = new Store(dir);
    store.importPdf(
      {
        token: randomUUID(),
        courseId: null,
        pages: [
          { page: 1, text: 'Antimicrobial Therapies Dr. Smith' },
          { page: 2, text: 'Beta-lactams block transpeptidation' },
          { page: 3, text: 'Resistance' },
        ],
        headings: [],
        organization: 'fallback',
      },
      'Antimicrobials.pdf',
      new Uint8Array(Buffer.from('%PDF-1.7')),
    );
    const doc = store.snapshot().documents[0];
    let reads = 0;
    const prep = (page: number) =>
      page === 1
        ? { kind: 'skip', reason: 'title and lecturer', summary: '', keyPoints: [], regions: [] }
        : {
            kind: 'teach',
            reason: 'mechanism',
            summary: 'Beta-lactams block cell wall cross-linking.',
            keyPoints: ['PBPs', 'transpeptidation'],
            regions: [
              {
                box: { x: 0.1, y: 0.1, width: 0.3, height: 0.05 },
                label: 'Mechanism',
                evidence: 'block transpeptidation',
                confidence: 0.9,
                shape: 'underline',
              },
            ],
          };
    const service = new TutorService(
      store,
      new Providers(
        { elevenKey: 'k', agentId: 'a', visionKey: 'v', model: 'm', quickModel: 'q' },
        async (url, init) => {
          if (String(url).includes('elevenlabs'))
            return new Response(JSON.stringify({ signed_url: 'wss://api.elevenlabs.io/x' }));
          reads++;
          const page = JSON.parse(JSON.parse(String(init?.body)).messages[0].content[0].text).slide;
          return new Response(
            JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(prep(page)) }] }),
          );
        },
      ),
      () => {},
      () => {},
    );
    const shot = (page: number, epoch = 0) => ({
      id: randomUUID(),
      epoch,
      source: { kind: 'pdf' as const, documentId: doc.id, page, name: doc.originalName },
      image: 'data:image/jpeg;base64,/9j/',
      width: 800,
      height: 600,
      capturedAt: new Date().toISOString(),
      textBoxes: [
        {
          text: 'Beta-lactams block transpeptidation',
          box: { x: 0.1, y: 0.2, width: 0.5, height: 0.05 },
        },
      ],
    });
    await service.start(null, 'voice', doc.id, 1);
    for (const p of [1, 2, 3]) service.prepareSlide(shot(p));
    service.prepareSlide(shot(2)); // repeated calls are free
    service.acceptSnapshot(shot(1, service.state.epoch), true);
    const first = await service.slideBriefing(2000);
    assert.equal(first?.kind, 'skip');
    assert.equal(first?.nextTeachingSlide, 2);
    service.acceptSnapshot(shot(2, service.state.epoch), true);
    const second = await service.slideBriefing(2000);
    assert.equal(second?.kind, 'teach');
    assert.equal(second?.regions.length, 1);
    assert.deepEqual(service.state.annotations.at(-1)?.box, {
      x: 0.1,
      y: 0.2,
      width: 0.5,
      height: 0.05,
    });
    assert.equal(reads, 3, 'each slide is read once');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
