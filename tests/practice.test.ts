import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../electron/store';
import { Providers } from '../electron/providers';
import { TutorService } from '../electron/tutor';
import {
  gradeChoice,
  groundMisconceptions,
  practice,
  question,
  reviewSuggestions,
  misconceptions,
  type PracticeAttempt,
} from '../shared/practice';
import { ToolSchema } from '../shared/tutor';

type Graded = {
  verdict: string;
  feedback: string;
  misconceptions: { id: string; evidence: string }[];
};
/** Anthropic fixture: records requests and answers with the scripted grade. */
function claude(grade: Graded | (() => Response)) {
  const bodies: any[] = [];
  const request: typeof fetch = async (input, init) => {
    if (String(input).startsWith('https://api.elevenlabs.io/'))
      return new Response(JSON.stringify({ signed_url: 'wss://api.elevenlabs.io/x' }));
    assert.equal(String(input), 'https://api.anthropic.com/v1/messages');
    bodies.push(JSON.parse(String(init?.body)));
    if (typeof grade === 'function') return grade();
    return new Response(
      JSON.stringify({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify(grade) }],
      }),
    );
  };
  return { request, bodies };
}
function workspace(request: typeof fetch) {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-practice-')),
    store = new Store(dir);
  store.importPdf(
    {
      token: randomUUID(),
      courseId: null,
      pages: [1, 2, 3].map((page) => ({ page, text: 'Energy investment' })),
      headings: [],
      organization: 'fallback',
    },
    'Glycolysis.pdf',
    new Uint8Array(Buffer.from('%PDF-1.7')),
  );
  const service = new TutorService(
    store,
    new Providers(
      { elevenKey: 'k', agentId: 'a', visionKey: 'v', model: 'claude-sonnet-4-6' },
      request,
    ),
    () => {},
    () => {},
  );
  return {
    dir,
    store,
    service,
    doc: store.snapshot().documents[0],
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test('authored practice is consistent: one correct option, catalog links and steps', () => {
  assert.equal(practice.length, 6);
  for (const q of practice) {
    assert.ok(q.step >= 1 && q.step <= 6);
    assert.ok(q.modelAnswer.length > 20 && q.rubric.length > 10);
    if (q.choices) {
      assert.equal(q.choices.filter((c) => c.correct).length, 1, q.id);
      for (const c of q.choices) if (c.correct) assert.equal(c.misconception, null);
    }
  }
  const linked = new Set(practice.flatMap((q) => q.choices?.map((c) => c.misconception) ?? []));
  for (const id of ['atp-produced-first-step', 'enzyme-consumed', 'gross-as-net'])
    assert.ok(linked.has(id as never));
  const wrong = gradeChoice(question('net-atp'), 'four');
  assert.equal(wrong.verdict, 'incorrect');
  assert.deepEqual(wrong.misconceptions, [{ id: 'gross-as-net', evidence: 'Four ATP' }]);
  assert.equal(gradeChoice(question('net-atp'), 'two').verdict, 'correct');
  assert.throws(() => gradeChoice(question('net-atp'), 'seven'), /listed answers/);
});

test('misconceptions need a real quote from the answer and a catalog ID', () => {
  const answer =
    'ATP is used, and I think breaking the phosphate bond releases energy for the cell.';
  assert.deepEqual(
    groundMisconceptions(answer, [
      {
        id: 'bond-breaking-releases-energy',
        evidence: 'breaking the  Phosphate bond releases energy',
      },
      { id: 'bond-breaking-releases-energy', evidence: 'breaking the phosphate bond' },
      { id: 'gross-as-net', evidence: 'nets four ATP' },
      { id: 'made-up', evidence: 'ATP is used' },
      { id: 'enzyme-consumed', evidence: 'is' },
    ]),
    [
      {
        id: 'bond-breaking-releases-energy',
        evidence: 'breaking the  Phosphate bond releases energy',
      },
    ],
  );
});

test('review comes only from the latest answer per question; a later correct answer clears it', () => {
  const at = (n: number) => new Date(Date.UTC(2026, 10, 14, 10, n)).toISOString();
  const base = {
    lessonId: null,
    sessionId: null,
    source: null,
    origin: 'student' as const,
    answerSource: 'typed' as const,
    feedback: 'x',
    grader: 'authored' as const,
    model: null,
  };
  const attempts: PracticeAttempt[] = [
    {
      ...base,
      id: randomUUID(),
      questionId: 'net-atp',
      answer: { kind: 'choice', choiceId: 'four' },
      verdict: 'incorrect',
      misconceptions: [{ id: 'gross-as-net', evidence: 'Four ATP' }],
      createdAt: at(1),
    },
    {
      ...base,
      id: randomUUID(),
      questionId: 'atp-first-step',
      answer: { kind: 'choice', choiceId: 'unchanged' },
      verdict: 'incorrect',
      misconceptions: [],
      createdAt: at(2),
    },
  ];
  const before = reviewSuggestions(attempts);
  assert.deepEqual(
    before.map((r) => [r.step, r.misconception, r.evidence]),
    [
      [1, null, null],
      [6, 'gross-as-net', 'Four ATP'],
    ],
  );
  attempts.push({
    ...attempts[0],
    id: randomUUID(),
    answer: { kind: 'choice', choiceId: 'two' },
    verdict: 'correct',
    misconceptions: [],
    createdAt: at(3),
  });
  assert.deepEqual(
    reviewSuggestions(attempts).map((r) => r.questionId),
    ['atp-first-step'],
  );
  assert.equal(misconceptions['gross-as-net'].step, 6);
});

test('student answers are graded, linked to lecture/session/lesson, and survive restart', async () => {
  const fake = claude({
    verdict: 'partial',
    feedback:
      'You are right that ATP is involved. The favourable change comes from the whole reaction.',
    misconceptions: [
      { id: 'bond-breaking-releases-energy', evidence: 'breaking its bond releases energy' },
      { id: 'committed-step', evidence: 'this commits glucose' },
    ],
  });
  const w = workspace(fake.request);
  try {
    const session = await w.service.start(null, 'text', w.doc.id, 3);
    const shown = w.service.openPractice();
    assert.equal(shown.question, 'atp-first-step');
    assert.equal((shown as any).modelAnswer, undefined, 'never reveal the answer up front');
    const lessonId = w.service.state.activeLessonId!;
    const choice = await w.service.answerPractice(
      'net-atp',
      { kind: 'choice', choiceId: 'four' },
      'student',
    );
    assert.equal(choice.grader, 'authored');
    assert.equal(fake.bodies.length, 0, 'option answers never call a model');
    const text = 'ATP gives energy because breaking its bond releases energy.';
    const written = await w.service.answerPractice(
      'energy-source',
      { kind: 'text', text },
      'student',
    );
    assert.equal(written.verdict, 'partial');
    assert.equal(written.grader, 'claude');
    assert.equal(written.model, 'claude-sonnet-4-6');
    assert.deepEqual(written.misconceptions, [
      { id: 'bond-breaking-releases-energy', evidence: 'breaking its bond releases energy' },
    ]);
    assert.equal(written.lessonId, lessonId);
    assert.equal(written.sessionId, session.id);
    assert.deepEqual(written.source, { documentId: w.doc.id, page: 3 });
    const sent = JSON.parse(fake.bodies[0].messages[0].content);
    assert.equal(sent.studentAnswer, text);
    assert.match(sent.modelAnswer, /negative free-energy change/);
    assert.equal(w.service.state.practice?.checking, false);
    const context = JSON.parse(w.service.context());
    assert.equal(context.practice.review.length, 2);
    assert.match(context.practice.note, /never from time spent/);

    const reopened = new Store(w.dir);
    assert.deepEqual(reopened.snapshot().attempts, w.store.snapshot().attempts);
    reopened.deleteAttempt(choice.id);
    assert.equal(reopened.snapshot().attempts.length, 1);
    reopened.deleteSession(session.id);
    assert.deepEqual(reopened.snapshot().attempts, []);
  } finally {
    w.cleanup();
  }
});

test('tutor-recorded answers use the student’s saved words as evidence, never a paraphrase', async () => {
  const fake = claude({
    verdict: 'incorrect',
    feedback: 'Four is the total produced; two were invested.',
    misconceptions: [{ id: 'gross-as-net', evidence: 'nets four ATP' }],
  });
  const w = workspace(fake.request);
  try {
    const session = await w.service.start(null, 'voice', undefined, undefined);
    w.store.addMessage(session.id, 'user', 'Hmm, I think glycolysis nets four ATP overall.');
    assert.equal(
      ToolSchema.parse({ name: 'record_practice_attempt', question: 'why-invest', answer: 'x' })
        .name,
      'record_practice_attempt',
    );
    const asked = (await w.service.tool(session.id, { name: 'ask_practice_question' })) as any;
    assert.equal(asked.question, 'atp-first-step');
    assert.equal(asked.modelAnswer, undefined);
    const heard = (await w.service.tool(session.id, {
      name: 'record_practice_attempt',
      question: 'why-invest',
      answer: 'glycolysis nets four ATP overall',
    })) as any;
    assert.equal(heard.answerSource, 'transcript');
    assert.equal(heard.possibleMisconceptions[0].evidence, 'nets four ATP');
    assert.equal(heard.possibleMisconceptions[0].reviewStep, 6);
    assert.match(heard.modelAnswer, /two ATP net/);
    const paraphrase = (await w.service.tool(session.id, {
      name: 'record_practice_attempt',
      question: 'why-invest',
      answer: 'The student believes the yield is four',
    })) as any;
    assert.equal(paraphrase.answerSource, 'reported');
    assert.deepEqual(paraphrase.possibleMisconceptions, []);
    // A spoken option is graded deterministically, without a model call.
    const calls = fake.bodies.length;
    const option = (await w.service.tool(session.id, {
      name: 'record_practice_attempt',
      question: 'net-atp',
      answer: 'Two ATP',
    })) as any;
    assert.equal(option.verdict, 'correct');
    assert.equal(fake.bodies.length, calls);
    assert.equal(w.store.snapshot().attempts.filter((a) => a.origin === 'tutor').length, 3);
  } finally {
    w.cleanup();
  }
});

test('grading failures save nothing; v5 data migrates to v6 with an exact backup', async () => {
  const w = workspace(claude(() => new Response('{}', { status: 529 })).request);
  try {
    w.service.openPractice('energy-source');
    await assert.rejects(
      w.service.answerPractice(
        'energy-source',
        { kind: 'text', text: 'ATP is consumed' },
        'student',
      ),
      /Answer checking failed \(529\)/,
    );
    assert.deepEqual(w.store.snapshot().attempts, []);
    assert.equal(w.service.state.practice?.checking, false);
    await assert.rejects(
      w.service.answerPractice('energy-source', { kind: 'text', text: '   ' }, 'student'),
    );
    const legacy: any = { ...w.store.snapshot(), version: 5 };
    delete legacy.attempts;
    const bytes = JSON.stringify(legacy);
    writeFileSync(w.store.file, bytes);
    const migrated = new Store(w.dir).snapshot();
    assert.equal(migrated.version, 6);
    assert.deepEqual(migrated.attempts, []);
    assert.equal(migrated.lessons.length, 1);
    assert.equal(readFileSync(w.store.file + '.v5.backup', 'utf8'), bytes);
  } finally {
    w.cleanup();
  }
});
