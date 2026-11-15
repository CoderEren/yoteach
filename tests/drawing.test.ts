import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../electron/store';
import { Providers } from '../electron/providers';
import { TutorService } from '../electron/tutor';
import { DiagramSchema, SketchSchema, layoutDiagram } from '../shared/drawing';
import { ToolSchema, type SharedSnapshot } from '../shared/tutor';
import { matchSpoken } from '../shared/speech-focus';
import { Captioner, alignedWords, startsNewPhrase } from '../shared/captions';

const vision = {
  explanation: 'ATP is invested first; the payoff comes later.',
  regions: [
    {
      box: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
      label: 'Investment',
      evidence: 'Energy investment',
      confidence: 0.95,
      shape: 'highlight',
    },
    {
      box: { x: 0.55, y: 0.6, width: 0.3, height: 0.05 },
      label: 'Payoff',
      evidence: 'Energy payoff',
      confidence: 0.92,
      shape: 'highlight',
    },
  ],
};
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-drawing-')),
    store = new Store(dir);
  store.importPdf(
    {
      token: randomUUID(),
      courseId: null,
      pages: [{ page: 1, text: 'Energy investment\nEnergy payoff' }],
      headings: [],
      organization: 'fallback',
    },
    'Glycolysis.pdf',
    new Uint8Array(Buffer.from('%PDF-1.7')),
  );
  let workspaceOpened = 0;
  const service = new TutorService(
    store,
    new Providers(
      { elevenKey: 'k', agentId: 'a', visionKey: 'v', model: 'claude-sonnet-4-6' },
      async (url, init) => {
        if (String(url).includes('elevenlabs'))
          return new Response(JSON.stringify({ signed_url: 'wss://api.elevenlabs.io/x' }));
        if (String(init?.body).includes('part of their screen with the cursor'))
          return new Response(
            JSON.stringify({
              content: [{ type: 'text', text: 'A receptor protein spanning the cell membrane.' }],
            }),
          );
        // The quick screen map and the question-specific analysis have different shapes.
        const map = String(init?.body).includes('You map a screenshot');
        const body = map ? { summary: vision.explanation, regions: vision.regions } : vision;
        return new Response(
          JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(body) }] }),
        );
      },
    ),
    () => {},
    () => {
      workspaceOpened++;
    },
  );
  const screenStill = (): SharedSnapshot => ({
    id: randomUUID(),
    epoch: service.state.epoch,
    source: {
      kind: 'screen',
      id: '1',
      name: 'Current screen',
      bounds: { x: 0, y: 0, width: 1512, height: 982 },
    },
    image: 'data:image/jpeg;base64,/9j/',
    width: 1512,
    height: 982,
    capturedAt: new Date().toISOString(),
    textBoxes: vision.regions.map((r) => ({ text: r.evidence, box: r.box })),
  });
  return {
    store,
    service,
    doc: store.snapshot().documents[0],
    screenStill,
    opened: () => workspaceOpened,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test('diagram layout is deterministic, finite and in bounds for flows, branches and cycles', () => {
  const flow = DiagramSchema.parse({
    title: 'Glycolysis energy',
    nodes: [
      { id: 'glucose', label: 'Glucose' },
      { id: 'invest', label: '2 ATP invested' },
      { id: 'split', label: 'Split into 2 × 3C' },
      { id: 'payoff', label: '4 ATP made' },
      { id: 'nadh', label: '2 NADH' },
    ],
    edges: [
      { from: 'glucose', to: 'invest' },
      { from: 'invest', to: 'split', label: 'primed' },
      { from: 'split', to: 'payoff' },
      { from: 'split', to: 'nadh' },
    ],
  });
  assert.equal(flow.layout, 'flow');
  const a = layoutDiagram(flow),
    b = layoutDiagram(flow);
  assert.deepEqual(a, b);
  const x = (id: string) => a.nodes.find((n) => n.id === id)!.x;
  assert.ok(x('glucose') < x('invest') && x('invest') < x('split') && x('split') < x('payoff'));
  assert.equal(x('payoff'), x('nadh'), 'branches share a column');
  const cycle = layoutDiagram(
    DiagramSchema.parse({
      title: 'Water cycle',
      layout: 'cycle',
      nodes: ['evaporate', 'condense', 'precipitate', 'collect'].map((id) => ({ id, label: id })),
      edges: [
        { from: 'evaporate', to: 'condense' },
        { from: 'condense', to: 'precipitate' },
        { from: 'precipitate', to: 'collect' },
        { from: 'collect', to: 'evaporate' },
      ],
    }),
  );
  for (const l of [a, cycle]) {
    for (const n of l.nodes) {
      assert.ok(n.x - n.w / 2 >= 0 && n.x + n.w / 2 <= l.width, `${n.id} x in bounds`);
      assert.ok(n.y - n.h / 2 >= 0 && n.y + n.h / 2 <= l.height, `${n.id} y in bounds`);
    }
    for (const e of l.edges) assert.doesNotMatch(e.d, /NaN|Infinity/);
  }
  assert.throws(() =>
    DiagramSchema.parse({ title: 'x', nodes: [{ id: 'a', label: 'A' }], edges: [] }),
  );
  assert.throws(() =>
    DiagramSchema.parse({
      title: 'x',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'ghost' }],
    }),
  );
});

test('drawing attaches only to grounded regions and follows the screen it was captured from', async () => {
  const f = setup();
  try {
    const s = await f.service.start(null, 'voice');
    await assert.rejects(
      f.service.tool(s.id, {
        name: 'draw_on_screen',
        marks: [{ regionId: randomUUID(), shape: 'circle' }],
        connections: [],
        clear: true,
      }),
      /analyze_current_screen with the question first/,
    );
    f.service.state.sharing = 'screen';
    f.service.acceptSnapshot(f.screenStill());
    const analysis = (await f.service.tool(s.id, {
      name: 'analyze_current_screen',
      question: 'Where is the energy investment?',
    })) as { regions: { regionId: string }[]; note: string };
    assert.match(analysis.note, /draw_on_screen/);
    const [invest, payoff] = analysis.regions.map((r) => r.regionId);
    await assert.rejects(
      f.service.tool(s.id, {
        name: 'draw_on_screen',
        marks: [{ regionId: randomUUID(), shape: 'circle' }],
        connections: [],
        clear: true,
      }),
      /Could not find .* on screen/,
    );
    const drawn = (await f.service.tool(
      s.id,
      ToolSchema.parse({
        name: 'draw_on_screen',
        marks: [
          { regionId: invest, shape: 'circle', label: 'ATP spent here' },
          { regionId: payoff, shape: 'underline' },
        ],
        connections: [{ from: invest, to: payoff, label: 'pays back' }],
      }),
    )) as { drawn: number; where: string };
    assert.equal(drawn.drawn, 3);
    assert.equal(drawn.where, 'on the student’s screen');
    const d = f.service.state.drawing!;
    assert.deepEqual(d.marks[0].box, vision.regions[0].box);
    assert.equal(d.marks[0].label, 'ATP spent here');
    assert.equal(f.service.state.focusRegion, invest);
    assert.equal(f.service.state.activity, 'pointing');
    // clear:false adds; the default replaces.
    await f.service.tool(s.id, {
      name: 'draw_on_screen',
      marks: [{ regionId: payoff, shape: 'box' }],
      connections: [],
      clear: false,
    });
    assert.equal(f.service.state.drawing!.marks.length, 3);
    await f.service.tool(
      s.id,
      ToolSchema.parse({ name: 'draw_on_screen', marks: [{ regionId: payoff, shape: 'point' }] }),
    );
    assert.equal(f.service.state.drawing!.marks.length, 1);
    // A sketch survives a new capture; grounded marks do not.
    await f.service.tool(
      s.id,
      ToolSchema.parse({
        name: 'sketch_diagram',
        diagram: {
          title: 'Investment then payoff',
          nodes: [
            { id: 'in', label: '2 ATP in' },
            { id: 'out', label: '4 ATP out' },
          ],
          edges: [{ from: 'in', to: 'out' }],
        },
      }),
    );
    f.service.stopSharing();
    assert.deepEqual(f.service.state.drawing!.marks, []);
    assert.equal(f.service.state.drawing!.diagram!.title, 'Investment then payoff');
    await f.service.tool(s.id, { name: 'clear_screen' });
    assert.equal(f.service.state.drawing, null);
    assert.equal(f.opened(), 0, 'drawing never brings the app window forward');
  } finally {
    f.cleanup();
  }
});

test('pointing at a new mark is a moment: Yoyo goes back to idle on its own', async (t) => {
  const f = setup();
  try {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const s = await f.service.start(null, 'voice');
    f.service.state.sharing = 'screen';
    f.service.acceptSnapshot(f.screenStill());
    f.service.preAnalyze();
    const map = (await Promise.race([
      f.service.screenMap(0),
      new Promise((r) => {
        t.mock.timers.tick(10);
        setImmediate(r);
      }),
    ])) as Awaited<ReturnType<typeof f.service.screenMap>> | undefined;
    const regionId = map?.regions[0]?.regionId ?? f.service.state.annotations[0]?.id;
    assert.ok(regionId, 'a region to point at');
    await f.service.tool(s.id, ToolSchema.parse({ name: 'draw_on_screen', marks: [{ regionId }] }));
    assert.equal(f.service.state.activity, 'pointing');
    t.mock.timers.tick(6000);
    assert.equal(
      f.service.state.activity,
      'idle',
      'never stuck on pointing, which blocked proactive help',
    );
  } finally {
    f.cleanup();
  }
});

test('an edge that skips a column arcs above the row instead of through the middle node', () => {
  const l = layoutDiagram(
    DiagramSchema.parse({
      title: 'Vector addition',
      nodes: [
        { id: 'start', label: 'Start' },
        { id: 'tip', label: 'Tip of A' },
        { id: 'end', label: 'End' },
      ],
      edges: [
        { from: 'start', to: 'tip', label: 'A' },
        { from: 'tip', to: 'end', label: 'B' },
        { from: 'start', to: 'end', label: 'A + B' },
      ],
    }),
  );
  const tip = l.nodes.find((n) => n.id === 'tip')!;
  const resultant = l.edges[2];
  assert.ok(resultant.ly < tip.y - tip.h / 2, 'label sits above the middle node');
  assert.match(resultant.d, / C /);
  for (const n of l.nodes) assert.ok(n.y - n.h / 2 >= 0);
});

test('the screen map is ready by release, merges with deeper analysis, and sketches validate', async () => {
  const f = setup();
  try {
    const s = await f.service.start(null, 'voice');
    f.service.state.sharing = 'screen';
    f.service.acceptSnapshot(f.screenStill());
    f.service.preAnalyze();
    const map = await f.service.screenMap();
    assert.ok(map);
    assert.equal(map!.summary, vision.explanation);
    assert.equal(map!.regions.length, 2);
    // Drawing works straight from the map, with no analyze_current_screen call.
    await f.service.tool(
      s.id,
      ToolSchema.parse({
        name: 'draw_on_screen',
        marks: [{ regionId: map!.regions[0].regionId, shape: 'circle' }],
      }),
    );
    // Deeper analysis adds regions; the map's IDs stay valid.
    await f.service.tool(s.id, { name: 'analyze_current_screen', question: 'More detail?' });
    assert.ok(f.service.state.annotations.some((a) => a.id === map!.regions[0].regionId));
    assert.equal(f.service.state.annotations.length, 4);
    const sketch = ToolSchema.parse({
      name: 'sketch_on_screen',
      title: 'Head to tail',
      near: map!.regions[1].regionId,
      elements: [
        { type: 'arrow', from: [10, 60], to: [45, 30], label: 'A' },
        { type: 'arrow', from: [45, 30], to: [85, 50], label: 'B' },
        {
          type: 'arrow',
          from: [10, 60],
          to: [85, 50],
          label: 'A + B',
          dashed: true,
          tone: 'accent',
        },
      ],
    });
    await f.service.tool(s.id, sketch);
    assert.equal(f.service.state.drawing!.sketch!.elements.length, 3);
    assert.deepEqual(f.service.state.drawing!.sketch!.near, vision.regions[1].box);
    await assert.rejects(
      f.service.tool(s.id, { ...sketch, near: randomUUID() } as never),
      /regionId from the latest screen map/,
    );
    // Forgiving: off-canvas points are clamped, unknown pieces dropped, the rest still drawn.
    const lenient = ToolSchema.parse({
      name: 'sketch_on_screen',
      title: 'x',
      elements: [
        {
          type: 'arrow',
          from: [10, 10],
          to: [500, 10],
          label: 'a very long label that goes on and on and on',
        },
        { type: 'hexagon', at: [1, 2] },
        { type: 'dot', at: [50, 30], step: 2, moveTo: [80, 30] },
      ],
      captions: ['First A', 'Then B'],
    }) as any;
    assert.equal(lenient.elements.length, 2);
    assert.deepEqual(lenient.elements[0].to, [100, 10]);
    assert.equal(lenient.elements[0].label.length, 40);
    assert.deepEqual(lenient.elements[1].moveTo, [80, 30]);
    assert.throws(() =>
      ToolSchema.parse({ name: 'sketch_on_screen', title: 'x', elements: [{ type: 'hexagon' }] }),
    );
    // A new capture drops grounded marks and the sketch's anchor, but keeps the sketch.
    f.service.stopSharing();
    assert.equal(f.service.state.drawing!.sketch!.near, null);
    assert.equal(await f.service.screenMap(), null);
  } finally {
    f.cleanup();
  }
});

test('every agent tool in docs/agent-tools is registered as a client tool and validated', () => {
  const client = readFileSync('src/tutor.tsx', 'utf8');
  for (const file of readdirSync('docs/agent-tools')) {
    const name = JSON.parse(readFileSync(`docs/agent-tools/${file}`, 'utf8')).name;
    assert.ok(client.includes(`'${name}'`), `${name} is not registered in src/tutor.tsx`);
    assert.ok(
      ToolSchema.options.some((o) => o.shape.name.value === name),
      `${name} has no ToolSchema entry`,
    );
  }
});

test('rich sketches: filled shapes, flowing ions and pulses parse forgivingly', () => {
  const neuron = SketchSchema.parse({
    title: 'A neuron fires',
    size: 'large',
    elements: [
      {
        type: 'shape',
        points: [
          [10, 30],
          [18, 22],
          [26, 30],
          [18, 38],
        ],
        fill: 'pink',
        label: 'soma',
      },
      {
        type: 'curve',
        points: [
          [26, 30],
          [60, 31],
          [92, 30],
        ],
        width: 9,
        tone: 'blue',
      },
      {
        type: 'pulse',
        path: [
          [26, 30],
          [92, 30],
        ],
        seconds: 1.5,
      },
      {
        type: 'flow',
        path: [
          [50, 10],
          [50, 29],
        ],
        symbol: 'Na+',
        count: 40,
        tone: 'green',
      },
      {
        type: 'flow',
        path: [
          [70, 29],
          [70, 8],
        ],
        symbol: 'K+',
        tone: 'nope',
      },
      { type: 'ellipse', at: [40, 50], rx: 6, ry: 3, fill: 'yellow' },
      { type: 'sparkles', at: [1, 1] },
    ],
  });
  assert.equal(neuron.size, 'large');
  assert.deepEqual(
    neuron.elements.map((e) => e.type),
    ['shape', 'curve', 'pulse', 'flow', 'flow', 'ellipse'],
  );
  const [, axon, , na, k] = neuron.elements as any[];
  assert.equal(axon.width, 6, 'stroke width is clamped');
  assert.equal(na.count, 12, 'particle count is clamped');
  assert.equal(na.seconds, 3);
  assert.equal(k.tone, undefined, 'an unknown colour falls back to ink');
});

test('circling words with the cursor while asking becomes a region the tutor is told about', async () => {
  const f = setup();
  try {
    const s = await f.service.start(null, 'voice');
    f.service.state.sharing = 'screen';
    const startedAt = Date.now() - 50;
    const ring = Array.from({ length: 70 }, (_, k) => {
      const a = (k / 60) * 2 * Math.PI;
      return { x: 0.32 + 0.08 * Math.cos(a), y: 0.4 + 0.04 * Math.sin(a), t: k * 16 };
    });
    // The path can arrive before the screen it was drawn over.
    f.service.setTrail({ startedAt, points: ring, aspect: 1512 / 982 });
    f.service.acceptSnapshot({
      ...f.screenStill(),
      textBoxes: [
        { text: 'HMG-CoA reductase', box: { x: 0.26, y: 0.39, width: 0.12, height: 0.02 } },
      ],
      words: [
        { text: 'HMG-CoA', line: 0, box: { x: 0.26, y: 0.39, width: 0.06, height: 0.02 } },
        { text: 'reductase', line: 0, box: { x: 0.325, y: 0.39, width: 0.055, height: 0.02 } },
      ],
    });
    const map = await f.service.screenMap(50);
    assert.equal(map?.pointer?.kind, 'circle');
    assert.equal(map!.pointer!.quote, 'HMG-CoA reductase');
    await f.service.tool(
      s.id,
      ToolSchema.parse({ name: 'draw_on_screen', marks: [{ regionId: map!.pointer!.regionId }] }),
    );
    assert.equal(f.service.state.drawing!.marks.length, 1);
    // A trail from an earlier hold never applies to a newer question's screen.
    f.service.setTrail({ startedAt: Date.now() + 60_000, points: ring, aspect: 1.5 });
    f.service.acceptSnapshot(f.screenStill());
    assert.equal(await f.service.screenMap(10), null);
  } finally {
    f.cleanup();
  }
});

test('circling a picture with no words still tells the tutor what it shows', async () => {
  const f = setup();
  try {
    await f.service.start(null, 'voice');
    f.service.state.sharing = 'screen';
    // A hand-drawn loop that does not quite close (about 85% of a full turn).
    const ring = Array.from({ length: 50 }, (_, k) => {
      const a = (k / 50) * 1.7 * Math.PI + 0.3;
      return { x: 0.6 + 0.06 * Math.cos(a), y: 0.5 + 0.07 * Math.sin(a), t: k * 16 };
    });
    f.service.setTrail({ startedAt: Date.now() - 50, points: ring, aspect: 1.5 });
    f.service.acceptSnapshot(f.screenStill());
    const map = await f.service.screenMap(500);
    assert.equal(map?.pointer?.kind, 'circle');
    assert.equal(map!.pointer!.quote, '');
    assert.equal(map!.pointer!.seen, 'A receptor protein spanning the cell membrane.');
  } finally {
    f.cleanup();
  }
});

test('live text elements using label retain their teaching labels without overriding explicit text', () => {
  const sketch = SketchSchema.parse({
    title: 'Voltage',
    elements: [
      { type: 'text', at: [50, 11], label: 'Depolarization (+30mV)' },
      { type: 'text', at: [60, 57], label: 'Wrong fallback', text: 'Repolarization' },
      { type: 'text', at: [20, 20], label: 123 },
    ],
  });
  assert.deepEqual(
    sketch.elements.filter((e) => e.type === 'text').map((e) => e.text),
    ['Depolarization (+30mV)', 'Repolarization'],
  );
});

async function mappedScreen(f: ReturnType<typeof setup>, t: import('node:test').TestContext) {
  const s = await f.service.start(null, 'voice');
  f.service.state.sharing = 'screen';
  f.service.acceptSnapshot(f.screenStill());
  f.service.preAnalyze();
  await Promise.race([
    f.service.screenMap(0),
    new Promise((r) => {
      t.mock.timers.tick(10);
      setImmediate(r);
    }),
  ]);
  const byLabel = (label: string) => f.service.state.annotations.find((a) => a.label === label)!;
  assert.ok(byLabel('Investment') && byLabel('Payoff'), 'both regions mapped');
  return { s, byLabel };
}

test('Yoyo keeps its talking animation through a pointing gesture', async (t) => {
  const f = setup();
  try {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { s, byLabel } = await mappedScreen(f, t);
    f.service.update({ sessionId: s.id, speaking: true, activity: 'speaking' });
    await f.service.tool(
      s.id,
      ToolSchema.parse({ name: 'draw_on_screen', marks: [{ regionId: byLabel('Payoff').id }] }),
    );
    assert.equal(f.service.state.activity, 'pointing');
    assert.equal(f.service.state.speaking, true, 'the voice flag is untouched by tools');
    t.mock.timers.tick(6000);
    assert.equal(f.service.state.activity, 'speaking', 'back to talking, not idle');
    await f.service.tool(s.id, { name: 'celebrate' });
    t.mock.timers.tick(2600);
    assert.equal(f.service.state.activity, 'speaking');
  } finally {
    f.cleanup();
  }
});

test('Yoyo walks to the part it is talking about, as it says it', async (t) => {
  const f = setup();
  try {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const { s, byLabel } = await mappedScreen(f, t);
    const before = f.service.state.focusRevision;
    for (const w of 'So first the cell spends energy on the investment'.split(' '))
      f.service.spoken(s.id, w);
    assert.equal(f.service.state.focusRegion, byLabel('Investment').id);
    assert.equal(f.service.state.focusSource, 'speech', 'pointed at, not highlighted');
    assert.equal(f.service.state.focusRevision, before + 1);
    assert.equal(f.service.state.activity, 'pointing');
    t.mock.timers.tick(2000);
    for (const w of 'and later comes the payoff'.split(' ')) f.service.spoken(s.id, w);
    assert.equal(f.service.state.focusRegion, byLabel('Payoff').id, 'moves on to part B');
    assert.equal(f.service.state.drawing, null, 'following speech never draws by itself');
    // While the student holds the talk key, Yoyo does not wander off.
    f.service.state.input = 'listening';
    t.mock.timers.tick(2000);
    for (const w of 'back to the energy investment'.split(' ')) f.service.spoken(s.id, w);
    assert.equal(f.service.state.focusRegion, byLabel('Payoff').id);
  } finally {
    f.cleanup();
  }
});

test('drawings fade away 15 seconds after Yoyo finishes talking, not while it explains', async (t) => {
  const f = setup();
  try {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { s, byLabel } = await mappedScreen(f, t);
    const talking = (speaking: boolean) => f.service.update({ sessionId: s.id, speaking });
    const draw = (label: string) =>
      f.service.tool(
        s.id,
        ToolSchema.parse({
          name: 'draw_on_screen',
          marks: [{ regionId: byLabel(label).id }],
          clear: false,
        }),
      );
    talking(true);
    await draw('Investment');
    t.mock.timers.tick(60_000);
    assert.ok(f.service.state.drawing, 'stays as long as Yoyo is still explaining');
    talking(false); // a short pause between sentences
    t.mock.timers.tick(5000);
    talking(true);
    await draw('Payoff');
    t.mock.timers.tick(30_000);
    assert.equal(f.service.state.drawing?.marks.length, 2, 'the pause did not count');
    talking(false); // the answer is over: the countdown starts now
    t.mock.timers.tick(14_000);
    assert.equal(f.service.state.drawingFading, false);
    t.mock.timers.tick(1000);
    assert.equal(f.service.state.drawingFading, true, 'fading out');
    assert.ok(f.service.state.drawing, 'still there while it fades');
    t.mock.timers.tick(900);
    assert.equal(f.service.state.drawing, null);
    assert.equal(f.service.state.drawingFading, false);
    assert.equal(f.service.state.focusRegion, null);
  } finally {
    f.cleanup();
  }
});

test('speech matching names parts by their labels, not by filler words', () => {
  const parts = [
    { id: 'a', label: 'Energy investment', evidence: 'Energy investment phase', drawn: false },
    { id: 'b', label: 'Payoff', evidence: 'Energy payoff phase', drawn: false },
    { id: 'c', label: 'Cell membrane', evidence: 'the membrane of the cell', drawn: true },
  ];
  assert.equal(matchSpoken('the investment of energy comes first'.split(' '), parts), 'a');
  assert.equal(matchSpoken('then we get the payoff'.split(' '), parts), 'b');
  assert.equal(matchSpoken('across the cell membranes'.split(' '), parts), 'c');
  assert.equal(matchSpoken('so this is the part where we look'.split(' '), parts), null);
  assert.equal(matchSpoken('energy'.split(' '), parts), null, 'one shared word is not enough');
});

test('subtitles follow the voice timings in short phrases and clear after it stops', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const text = '[warmly] Glucose gets two phosphates, so it is trapped.';
  const chars = [...text];
  const words = alignedWords({ chars, char_start_times_ms: chars.map((_, i) => i * 50) });
  assert.deepEqual(
    words.map((w) => w.word),
    ['Glucose', 'gets', 'two', 'phosphates,', 'so', 'it', 'is', 'trapped.'],
  );
  assert.equal(words[0].at, 9 * 50, 'timed from its first character');
  assert.equal(startsNewPhrase(['one', 'two', 'three,']), true);
  assert.equal(startsNewPhrase(['one,']), false, 'a lone comma does not split');
  const seen: [string, string][] = [];
  const c = new Captioner((caption, word) => seen.push([caption, word]));
  c.chunk({ chars, char_start_times_ms: chars.map((_, i) => i * 50) });
  t.mock.timers.tick(9 * 50);
  assert.deepEqual(seen.at(-1), ['Glucose', 'Glucose']);
  t.mock.timers.tick(10_000);
  assert.deepEqual(seen.at(-1), ['so it is trapped.', 'trapped.'], 'new phrase after the comma');
  c.response('ignored once timings arrive');
  c.finished();
  t.mock.timers.tick(1400);
  assert.deepEqual(seen.at(-1), ['', '']);
  // Without timings, words are paced from the response text instead.
  const paced: string[] = [];
  const d = new Captioner((caption) => paced.push(caption), 300);
  d.response('Hello there student .');
  t.mock.timers.tick(900);
  t.mock.timers.tick(600);
  assert.equal(paced.at(-1), 'Hello there student.', 'no space before punctuation');
  d.stop();
  assert.equal(paced.at(-1), '');
});

/** Split text into audio chunks at the given character offsets, 40 ms per character. */
function chunksOf(text: string, cuts: number[]) {
  const edges = [0, ...cuts, text.length];
  return edges.slice(1).map((end, i) => {
    const chars = [...text.slice(edges[i], end)];
    return { chars, char_start_times_ms: chars.map((_, j) => j * 40) };
  });
}
function play(
  t: import('node:test').TestContext,
  text: string,
  cuts: number[],
  opts: { gap?: number } = {},
) {
  const shown: string[] = [];
  const c = new Captioner((caption) => shown.push(caption));
  for (const chunk of chunksOf(text, cuts)) {
    c.chunk(chunk);
    t.mock.timers.tick(chunk.chars.length * 40 + (opts.gap ?? 0));
  }
  c.finished();
  return { c, shown };
}

test('subtitles never cut a word that spans two audio chunks', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const text = 'ATP activates glucose, then the payoff begins.';
  // Cut inside "glucose" and inside "payoff", and once exactly between words.
  const { shown } = play(t, text, [
    text.indexOf('cose'),
    text.indexOf(' then'),
    text.indexOf('off'),
  ]);
  const all = shown.filter(Boolean);
  for (const caption of all)
    for (const word of caption.split(' '))
      assert.ok(
        text.split(' ').includes(word) ||
          text.split(' ').some((w) => w.replace(/[.,]$/, '') === word),
        `"${word}" in "${caption}" is a whole word`,
      );
  assert.ok(all.includes('ATP activates glucose,'), 'the split word appears whole');
  assert.equal(all.at(-1), 'then the payoff begins.');
  // A split word whose continuation arrives late is still shown, never lost.
  const late = play(t, 'Glycolysis splits sugar', [13], { gap: 600 });
  assert.ok(late.shown.includes('Glycolysis splits sugar'));
  assert.ok(!late.shown.some((s) => / (sp|lits)( |$)/.test(s)));
});

test('subtitle words keep spoken order, voice tags vanish across chunks, no stray spaces', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const text = 'So [cheer fully] here it is , right ?';
  const { shown } = play(t, text, [8, 16]);
  assert.ok(shown.includes('So here it is,'), 'comma glued to its word');
  assert.equal(shown.filter(Boolean).at(-1), 'right?');
  assert.ok(!shown.some((s) => /\[|\]|ful|  /.test(s)));
  // Paced words from the text are dropped when real timings turn up, never mixed in.
  const mixed: string[] = [];
  const c = new Captioner((caption) => mixed.push(caption), 100);
  c.response('one two three four');
  t.mock.timers.tick(900);
  t.mock.timers.tick(100);
  c.chunk({
    chars: [...'alpha beta'],
    char_start_times_ms: [...'alpha beta'].map((_, i) => i * 40),
  });
  t.mock.timers.tick(1000);
  assert.equal(mixed.filter(Boolean).at(-1), 'alpha beta');
});

test('the screen stays calm: a few marks per call, a few on screen, few moving parts per sketch', async (t) => {
  const f = setup();
  try {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { s, byLabel } = await mappedScreen(f, t);
    const both = [{ regionId: byLabel('Investment').id }, { regionId: byLabel('Payoff').id }];
    const result = (await f.service.tool(
      s.id,
      ToolSchema.parse({
        name: 'draw_on_screen',
        marks: [...both, ...both, ...both],
        connections: [1, 2, 3, 4].map(() => ({
          from: byLabel('Investment').id,
          to: byLabel('Payoff').id,
        })),
      }),
    )) as { note: string };
    assert.equal(f.service.state.drawing?.marks.length, 3, 'three marks per call');
    assert.equal(f.service.state.drawing?.connections.length, 2, 'two connections per call');
    assert.match(result.note, /mark the next part when you reach it/);
    for (let i = 0; i < 3; i++)
      await f.service.tool(
        s.id,
        ToolSchema.parse({ name: 'draw_on_screen', marks: both, connections: [], clear: false }),
      );
    assert.equal(f.service.state.drawing?.marks.length, 5, 'older marks make way');
    await f.service.tool(
      s.id,
      ToolSchema.parse({
        name: 'sketch_on_screen',
        title: 'Ions',
        elements: [
          { type: 'circle', at: [50, 35], r: 10 },
          ...[10, 20, 30, 40].map((y) => ({
            type: 'flow',
            path: [
              [0, y],
              [100, y],
            ],
          })),
        ],
      }),
    );
    const kinds = f.service.state.drawing?.sketch?.elements.map((e) => e.type);
    assert.deepEqual(kinds, ['circle', 'flow', 'flow']);
  } finally {
    f.cleanup();
  }
});
