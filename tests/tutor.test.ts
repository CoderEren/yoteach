import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../electron/store';
import { Providers, type VisionAnswer } from '../electron/providers';
import { TutorService, groundRegions } from '../electron/tutor';
import { SnapshotSchema, ToolSchema, type SharedSnapshot } from '../shared/tutor';
const config = {
  elevenKey: 'test-secret',
  agentId: 'test-agent',
  visionKey: 'test-vision-secret',
  model: 'claude-sonnet-4-6',
};
const answer: VisionAnswer = {
  explanation: 'ATP activates the substrate.',
  regions: [
    {
      box: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
      label: 'ATP investment',
      evidence: 'ATP investment',
      confidence: 0.95,
      shape: 'highlight',
    },
  ],
};
function setup(
  request: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?signature=test',
      }),
    ),
) {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-tutor-')),
    store = new Store(dir);
  const course = store.command({ type: 'course.create', title: 'Biochemistry', color: 'iris' })
    .courses[0];
  store.importPdf(
    {
      token: randomUUID(),
      courseId: course.id,
      pages: [{ page: 1, text: 'ATP investment' }],
      headings: [{ title: 'Glycolysis', page: 1, level: 1 }],
      organization: 'headings',
    },
    'Lecture.pdf',
    new Uint8Array(Buffer.from('%PDF-1.7')),
  );
  store.command({
    type: 'topic.create',
    courseId: course.id,
    title: 'Legacy notes',
    parentId: null,
  });
  const topic = store.snapshot().topics[0],
    doc = store.snapshot().documents[0];
  let navigated = '';
  const service = new TutorService(
    store,
    new Providers(config, request),
    () => {},
    () => {
      navigated = 'workspace';
    },
  );
  const snapshot = (epoch = service.state.epoch): SharedSnapshot => ({
    id: randomUUID(),
    epoch,
    source: { kind: 'pdf', documentId: doc.id, page: 1, name: doc.originalName },
    image: 'data:image/jpeg;base64,/9j/',
    width: 600,
    height: 800,
    capturedAt: new Date().toISOString(),
    textBoxes: [{ text: 'ATP investment', box: { x: 0.2, y: 0.4, width: 0.5, height: 0.04 } }],
  });
  return {
    dir,
    store,
    service,
    topic,
    doc,
    course,
    snapshot,
    navigated: () => navigated,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
test('Stage 1 migration preserves notes and persists the current version safely', () => {
  const f = setup();
  try {
    const old = { ...f.store.snapshot(), version: 1 };
    delete (old as any).sessions;
    delete (old as any).messages;
    delete (old as any).explanations;
    writeFileSync(f.store.file, JSON.stringify(old));
    const next = new Store(f.dir).snapshot();
    assert.equal(next.version, 8);
    assert.equal(next.documents[0].id, f.doc.id);
    assert.deepEqual(next.sessions, []);
  } finally {
    f.cleanup();
  }
});
test('grounding uses actual unique PDF text geometry, rejects invented, ambiguous and low confidence evidence', () => {
  const f = setup();
  try {
    const image = f.snapshot();
    const result = groundRegions(image, answer);
    assert.deepEqual(result[0].box, image.textBoxes[0].box);
    assert.equal(result[0].precision, 'pdf-text');
    assert.equal(
      groundRegions(image, {
        ...answer,
        regions: [{ ...answer.regions[0], evidence: 'Not on page' }],
      }).length,
      0,
    );
    assert.equal(
      groundRegions(image, { ...answer, regions: [{ ...answer.regions[0], confidence: 0.3 }] })
        .length,
      0,
    );
    image.textBoxes.push(image.textBoxes[0]);
    assert.equal(groundRegions(image, answer).length, 0);
    assert.throws(() =>
      SnapshotSchema.parse({
        ...image,
        textBoxes: [{ text: 'x', box: { x: 0.9, y: 0.9, width: 0.3, height: 0.3 } }],
      }),
    );
    assert.throws(() => ToolSchema.parse({ name: 'draw_annotation', x: 42, y: 42 }));
  } finally {
    f.cleanup();
  }
});
test('pause/revoke discards in-flight vision, clears screenshots and rejects stale regions', async () => {
  let resolveAnalysis: (r: Response) => void = () => {};
  const f = setup(async (url) =>
    String(url).includes('signed-url')
      ? new Response(
          JSON.stringify({
            signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?signature=test',
          }),
        )
      : new Promise((r) => {
          resolveAnalysis = r;
        }),
  );
  try {
    const start = await f.service.start(f.topic.id, 'text');
    f.service.acceptSnapshot(f.snapshot(), true);
    const request = f.service.tool(start.id, {
      name: 'analyze_current_screen',
      question: 'Why ATP?',
    });
    f.service.stopSharing();
    resolveAnalysis(
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: JSON.stringify(answer) }],
        }),
      ),
    );
    await assert.rejects(request, /discarded/);
    assert.equal(f.service.state.snapshot, null);
    assert.deepEqual(f.service.state.annotations, []);
    await assert.rejects(
      f.service.tool(start.id, {
        name: 'draw_annotation',
        snapshotId: randomUUID(),
        regionId: randomUUID(),
        shape: 'circle',
      }),
      /no longer/,
    );
    assert.ok(!readFileSync(f.store.file, 'utf8').includes('data:image'));
  } finally {
    f.cleanup();
  }
});
test('tools navigate, save actual explanations, record notes; history survives restart and cascading deletion', async () => {
  const f = setup();
  try {
    const start = await f.service.start(f.topic.id, 'text');
    f.service.transcript(start.id, 'user', 'Why ATP?', 'user:1');
    f.service.transcript(start.id, 'assistant', 'ATP activates glucose.', 'agent:2');
    f.service.transcript(start.id, 'assistant', 'ATP activates the substrate.', 'agent:2');
    assert.equal(f.store.snapshot().messages.length, 2);
    await f.service.tool(start.id, { name: 'save_explanation', title: 'Why invest ATP?' });
    await f.service.tool(start.id, {
      name: 'record_learning_interaction',
      note: 'Student asked about activation.',
    });

    const next = new Store(f.dir).snapshot();
    assert.equal(next.explanations[0].text, 'ATP activates the substrate.');
    assert.equal(next.messages.length, 3);
    assert.ok(next.sessions[0].endedAt);
    f.service.end();
    f.store.command({ type: 'course.delete', id: f.course.id });
    const removed = f.store.snapshot();
    assert.equal(removed.sessions.length, 0);
    assert.equal(removed.explanations.length, 0);
    assert.equal(removed.messages.length, 0);
  } finally {
    f.cleanup();
  }
});
test('vision request stays server-side, structured and validated; configuration excludes secrets', async () => {
  let request: RequestInit | undefined;
  const p = new Providers(config, async (url, init) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    request = init;
    return new Response(
      JSON.stringify({
        content: [{ type: 'text', text: JSON.stringify(answer) }],
      }),
    );
  });
  const f = setup();
  try {
    await p.analyze(f.snapshot(), 'Why?', 'context', new AbortController().signal);
    const body = JSON.parse(String(request?.body));
    assert.equal(body.output_config.format.type, 'json_schema');
    assert.equal(body.messages[0].content[1].type, 'image');
    assert.equal(body.messages[0].content[1].source.media_type, 'image/jpeg');
    assert.equal((request?.headers as Record<string, string>)['anthropic-version'], '2023-06-01');
    assert.ok(!JSON.stringify(p.status()).includes('secret'));
    assert.ok(!String(request?.body).includes('test-vision-secret'));
  } finally {
    f.cleanup();
  }
});
test('signed URL host, missing configuration, foreign PDF and ended session are rejected', async () => {
  const p = new Providers(
    config,
    async () => new Response(JSON.stringify({ signed_url: 'wss://attacker.example/socket' })),
  );
  await assert.rejects(p.signedUrl(new AbortController().signal), /unsupported/);
  const empty = new Providers({ ...config, elevenKey: '' });
  await assert.rejects(empty.signedUrl(new AbortController().signal), /ELEVENLABS_API_KEY/);
  const f = setup();
  try {
    const start = await f.service.start(f.topic.id, 'text');
    const invalid = f.snapshot();
    if (invalid.source.kind === 'pdf') invalid.source.documentId = randomUUID();
    assert.throws(() => f.service.acceptSnapshot(invalid, true), /existing PDF/);
    f.service.end();
    assert.throws(() => f.service.transcript(start.id, 'user', 'late', 'late'), /ended/);
  } finally {
    f.cleanup();
  }
});
test('cancel during session authentication never creates a late session', async () => {
  let resolveAuth: (r: Response) => void = () => {};
  const f = setup(
    () =>
      new Promise((r) => {
        resolveAuth = r;
      }),
  );
  try {
    const pending = f.service.start(f.topic.id, 'text');
    f.service.end();
    resolveAuth(
      new Response(
        JSON.stringify({
          signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?signature=test',
        }),
      ),
    );
    await assert.rejects(pending, /cancelled/);
    assert.equal(f.service.state.sessionId, null);
    assert.equal(f.store.snapshot().sessions.length, 0);
  } finally {
    f.cleanup();
  }
});

test('rotated PDF text uses its visible vertical footprint instead of an unrelated horizontal region', async () => {
  const { textRunBox } = await import('../shared/pdf-geometry');
  const horizontal = textRunBox([20, 0, 0, -20, 100, 200], 100, 1000, 1000)!;
  const rotated = textRunBox([0, 20, 20, 0, 100, 200], 100, 1000, 1000)!;
  assert.equal(horizontal.x, 0.1);
  assert.equal(horizontal.y, 0.18);
  assert.equal(rotated.x, 0.1);
  assert.equal(rotated.y, 0.2);
  assert.ok(Math.abs(rotated.width - 0.02) < 1e-9);
  assert.ok(Math.abs(rotated.height - 0.1) < 1e-9);
  assert.equal(textRunBox([20, 0, 0, -20, -200, 200], 100, 1000, 1000), null);
});

test('topic-free tutoring and lecture progress survive settings updates and restart', async () => {
  const f = setup();
  try {
    const free = await f.service.start(null, 'text');
    f.service.transcript(free.id, 'assistant', 'A general explanation.', 'a');
    f.store.command({ type: 'settings.update', theme: 'dark' });
    assert.equal(f.store.snapshot().sessions.at(-1)?.topicId, null);
    f.service.end();
    const lecture = await f.service.start(null, 'voice', f.doc.id);
    f.service.acceptSnapshot(f.snapshot(), true);
    f.service.update({ sessionId: lecture.id, lecturePreparing: false });
    await f.service.tool(lecture.id, { name: 'navigate_slide', page: 1 });
    assert.equal(f.service.state.snapshot, null);
    assert.equal(f.service.state.lecture?.page, 1);
    await assert.rejects(f.service.tool(lecture.id, { name: 'navigate_slide', page: 2 }));
    f.service.end();
    const reloaded = new Store(f.dir).snapshot();
    assert.equal(reloaded.sessions.at(-1)?.documentId, f.doc.id);
    assert.equal(reloaded.messages[0].text, 'A general explanation.');
  } finally {
    f.cleanup();
  }
});
test('Anthropic errors, refusal, truncation and invalid structured data are rejected', async () => {
  const f = setup();
  try {
    for (const payload of [
      { stop_reason: 'refusal' },
      { stop_reason: 'max_tokens' },
      { content: [{ type: 'text', text: 'not json' }] },
    ]) {
      const p = new Providers(config, async () => new Response(JSON.stringify(payload)));
      await assert.rejects(p.analyze(f.snapshot(), 'Explain', '', new AbortController().signal));
    }
    for (const status of [401, 403, 429, 500]) {
      const p = new Providers(config, async () => new Response('{}', { status }));
      await assert.rejects(
        p.analyze(f.snapshot(), 'Explain', '', new AbortController().signal),
        new RegExp(String(status)),
      );
    }
  } finally {
    f.cleanup();
  }
});

test('version 2 migration preserves every legacy record and backs up exact original bytes', async () => {
  const f = setup();
  try {
    const session = await f.service.start(f.topic.id, 'text');
    f.service.transcript(session.id, 'assistant', 'Keep this explanation.', 'saved');
    await f.service.tool(session.id, { name: 'save_explanation', title: 'Preserved' });
    f.store.command({
      type: 'topic.update',
      id: f.topic.id,
      title: f.topic.title,
      parentId: null,
      overview: 'Keep these notes.',
    });
    const legacy: any = { ...f.store.snapshot(), version: 2 };
    legacy.sessions.forEach((s: any) => {
      delete s.documentId;
      delete s.page;
    });
    const bytes = JSON.stringify(legacy);
    writeFileSync(f.store.file, bytes);
    const migrated = new Store(f.dir).snapshot();
    assert.equal(readFileSync(f.store.file + '.v2.backup', 'utf8'), bytes);
    assert.equal(migrated.topics[0].overview, 'Keep these notes.');
    assert.equal(migrated.documents[0].id, f.doc.id);
    assert.equal(migrated.sessions[0].topicId, f.topic.id);
    assert.equal(migrated.explanations[0].text, 'Keep this explanation.');
    assert.equal(migrated.messages[0].text, 'Keep this explanation.');
  } finally {
    f.cleanup();
  }
});

test('v7 data drops the old built-in lesson and practice answers, keeps media, with an exact backup', () => {
  const f = setup();
  try {
    const now = new Date().toISOString();
    const legacy: any = { ...f.store.snapshot(), version: 7 };
    legacy.lessons = [
      {
        id: randomUUID(),
        key: 'glucose-phosphorylation',
        step: 4,
        sessionId: null,
        source: null,
        createdAt: now,
        updatedAt: now,
      },
    ];
    legacy.attempts = [{ id: randomUUID(), questionId: 'energy-source' }];
    legacy.media = [];
    const bytes = JSON.stringify(legacy);
    writeFileSync(f.store.file, bytes);
    const migrated = new Store(f.dir).snapshot() as any;
    assert.equal(migrated.version, 8);
    assert.equal(migrated.lessons, undefined);
    assert.equal(migrated.attempts, undefined);
    assert.deepEqual(migrated.documents, legacy.documents);
    assert.equal(readFileSync(f.store.file + '.v7.backup', 'utf8'), bytes);
    // Older data still migrates all the way.
    const older: any = { ...f.store.snapshot(), version: 3 };
    delete older.chats;
    writeFileSync(f.store.file, JSON.stringify(older));
    assert.equal(new Store(f.dir).snapshot().version, 8);
  } finally {
    f.cleanup();
  }
});

test('tools reject sessions that have ended', async () => {
  const f = setup();
  try {
    const session = await f.service.start(null, 'text');
    f.service.end();
    await assert.rejects(f.service.tool(session.id, { name: 'clear_screen' }), /ended/);
  } finally {
    f.cleanup();
  }
});
