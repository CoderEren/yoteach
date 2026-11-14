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
  model: 'gpt-4.1-mini',
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
  const topic = store.snapshot().topics[0],
    doc = store.snapshot().documents[0];
  let navigated = '';
  const service = new TutorService(
    store,
    new Providers(config, request),
    () => {},
    (id) => {
      navigated = id;
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
test('Stage 1 migration preserves notes and persists version 2 safely', () => {
  const f = setup();
  try {
    const old = { ...f.store.snapshot(), version: 1 };
    delete (old as any).sessions;
    delete (old as any).messages;
    delete (old as any).explanations;
    writeFileSync(f.store.file, JSON.stringify(old));
    const next = new Store(f.dir).snapshot();
    assert.equal(next.version, 2);
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
          output: [{ content: [{ type: 'output_text', text: JSON.stringify(answer) }] }],
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
    await f.service.tool(start.id, { name: 'open_topic', topicId: f.topic.id });
    assert.equal(f.navigated(), f.topic.id);
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
test('vision request stays server-side, structured and non-storing; configuration excludes secrets', async () => {
  let request: RequestInit | undefined;
  const p = new Providers(config, async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    request = init;
    return new Response(
      JSON.stringify({
        output: [{ content: [{ type: 'output_text', text: JSON.stringify(answer) }] }],
      }),
    );
  });
  const f = setup();
  try {
    await p.analyze(f.snapshot(), 'Why?', 'context', new AbortController().signal);
    const body = JSON.parse(String(request?.body));
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, 'json_schema');
    assert.equal(body.text.format.strict, true);
    assert.equal(body.input[0].content[1].type, 'input_image');
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
    assert.throws(() => f.service.acceptSnapshot(invalid, true), /current session/);
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
