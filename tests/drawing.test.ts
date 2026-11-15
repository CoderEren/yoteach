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
    textBoxes: [],
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
