import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
  type WebSocketRoute,
} from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
async function launch(dir: string, extra: Record<string, string> = {}) {
  const env = {
    ...process.env,
    ...extra,
    YOTEACH_DATA_DIR: dir,
    ELEVENLABS_API_KEY: 'test-only-key',
    ELEVENLABS_AGENT_ID: 'test-only-agent',
    ANTHROPIC_API_KEY: 'test-only-vision',
    FAL_KEY: 'test-only-fal',
    FAL_IMAGE_MODEL: 'fal-ai/flux/schnell',
    FAL_VIDEO_MODEL: extra.FAL_VIDEO_MODEL ?? '',
  } as Record<string, string>;
  delete env.ELECTRON_RUN_AS_NODE;
  if (process.env.YOTEACH_TEST_DEV === '1') env.YOTEACH_DEV_URL = 'http://127.0.0.1:5173';
  else delete env.YOTEACH_DEV_URL;
  const app = await electron.launch({ args: ['.'], env });
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('#/'))).toBe(true);
  const page = app.windows().find((w) => w.url().endsWith('#/'))!;
  await expect(page.getByRole('button', { name: 'Chats', exact: true })).toBeVisible();
  return { app, page };
}
async function fixtures(app: ElectronApplication, page: Page) {
  await app.evaluate(({ systemPreferences, nativeImage }) => {
    systemPreferences.askForMediaAccess = async () => true;
    globalThis.fetch = async (input) => {
      if (
        String(input).startsWith('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url')
      )
        return new Response(
          JSON.stringify({
            signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?signature=test-only',
          }),
        );
      if (String(input) === 'https://api.anthropic.com/v1/messages')
        return new Response(
          JSON.stringify({
            stop_reason: 'end_turn',
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  explanation: 'ATP activates glucose before the payoff phase.',
                  regions: [
                    {
                      box: { x: 0.5, y: 0.25, width: 0.2, height: 0.08 },
                      label: 'Energy investment',
                      evidence: 'Energy investment phase',
                      confidence: 0.98,
                      shape: 'highlight',
                    },
                  ],
                }),
              },
            ],
          }),
        );
      throw new Error('Unexpected live request in fixture test');
    };
    // Replace only the screenshot subprocess in this isolated process. No user desktop is captured.
    const cp = process.getBuiltinModule('node:child_process')!,
      util = process.getBuiltinModule('node:util')!;
    const original: any = cp.execFile;
    const fake: any = (...args: any[]) => original(...args);
    fake[util.promisify.custom] = async (path: string, ...args: any[]) => {
      if (path.endsWith('/capture-screen')) {
        (globalThis as any).__captures = ((globalThis as any).__captures ?? 0) + 1;
        return {
          stdout: JSON.stringify({
            image:
              'data:image/jpeg;base64,' +
              nativeImage
                .createFromPath(process.cwd() + '/assets/icons/yoyo.png')
                .resize({ width: 1200, height: 800 })
                .toJPEG(80)
                .toString('base64'),
            width: 1200,
            height: 800,
            textBoxes: [
              {
                text: 'Energy investment phase',
                box: { x: 0.5, y: 0.25, width: 0.2, height: 0.08 },
              },
            ],
            words: ((globalThis as any).__captureWords ?? []).map((text: string, i: number) => ({
              text,
              line: 0,
              box: { x: 0.05 + i * 0.06, y: 0.3, width: 0.05, height: 0.03 },
            })),
          }),
          stderr: '',
        };
      }
      return (util.promisify(original) as any)(path, ...args);
    };
    (cp as any).execFile = fake;
    process.getBuiltinModule('node:module')!.syncBuiltinESMExports();
  });
  await page.addInitScript(() => {
    const streams: MediaStream[] = [],
      contexts: AudioContext[] = [];
    (window as any).__testStreams = streams;
    (window as any).__testContexts = contexts;
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext(),
        target = context.createMediaStreamDestination(),
        tone = context.createOscillator();
      tone.frequency.value = 300;
      tone.connect(target);
      tone.start();
      await context.resume();
      contexts.push(context);
      streams.push(target.stream);
      return target.stream;
    };
  });
  await page.reload();
  let socket: WebSocketRoute | undefined;
  let event = 0,
    audioChunks = 0;
  const messages: any[] = [],
    results = new Map<string, any>();
  await page.routeWebSocket('wss://api.elevenlabs.io/**', (ws) => {
    socket = ws;
    ws.onMessage((raw) => {
      const data = JSON.parse(String(raw));
      messages.push(data);
      if (data.type === 'conversation_initiation_client_data')
        ws.send(
          JSON.stringify({
            type: 'conversation_initiation_metadata',
            conversation_initiation_metadata_event: {
              conversation_id: 'fixture-conversation',
              agent_output_audio_format: 'pcm_16000',
              user_input_audio_format: 'pcm_16000',
            },
          }),
        );
      if (data.user_audio_chunk) audioChunks++;
      if (data.type === 'user_message')
        ws.send(
          JSON.stringify({
            type: 'agent_response',
            agent_response_event: {
              agent_response: 'ATP activates glucose before the payoff phase.',
              event_id: ++event,
            },
          }),
        );
      if (data.type === 'client_tool_result')
        results.set(data.tool_call_id, JSON.parse(data.result));
    });
  });
  return {
    messages,
    chunks: () => audioChunks,
    send(data: unknown) {
      socket!.send(JSON.stringify(data));
    },
    async tool(name: string, parameters: object = {}) {
      const id = String(++event);
      socket!.send(
        JSON.stringify({
          type: 'client_tool_call',
          client_tool_call: { tool_name: name, tool_call_id: id, parameters },
        }),
      );
      await expect.poll(() => results.has(id)).toBe(true);
      const result = results.get(id);
      expect(result.error).toBeUndefined();
      return result;
    },
  };
}
const runtime = async (page: Page) => {
  const r = await page.evaluate(() => window.yoteach.tutor.get());
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

test('full-screen lecture teaches, grounds six tools, accepts questions and preserves history', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-lecture-'));
  let app: ElectronApplication | undefined;
  try {
    const boot = await launch(dir);
    app = boot.app;
    const page = boot.page;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const provider = await fixtures(app, page);
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    }, resolve('public/sample-lecture.pdf'));
    await page.getByRole('button', { name: 'Lectures', exact: true }).click();
    await page.getByRole('button', { name: /Upload a lecture PDF/ }).click();
    await expect(
      page.getByRole('button', { name: 'Run me through the lecture', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Run me through the lecture', exact: true }).click();
    await expect(page.locator('.lecture-slide-image img')).toBeVisible();
    await expect
      .poll(() =>
        app!.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('#/'))!
            .isFullScreen(),
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        provider.messages.some(
          (m) =>
            m.type === 'user_message' &&
            /Teach this slide now|no teachable content|only introduces/.test(m.text),
        ),
      )
      .toBe(true);
    expect(await page.evaluate(() => (window as any).__testStreams.length)).toBe(0); // lecture speaks without opening mic
    await expect(page.getByLabel('Ask Yoyo')).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    for (const slide of [2, 3]) {
      await expect(page.getByRole('button', { name: 'Next slide', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Next slide', exact: true }).click();
      await expect.poll(async () => (await runtime(page)).lecture?.page).toBe(slide);
    }
    await expect.poll(async () => (await runtime(page)).lecturePreparing).toBe(false);
    const region = await provider.tool('analyze_current_screen', { question: 'Why invest ATP?' });
    expect(region.regions[0].precision).toBe('pdf-text');
    await provider.tool('highlight_screen_region', {
      snapshotId: region.snapshotId,
      regionId: region.regions[0].regionId,
    });
    await expect(page.locator('.annotation-highlight')).toBeVisible();
    await provider.tool('draw_annotation', {
      snapshotId: region.snapshotId,
      regionId: region.regions[0].regionId,
      shape: 'circle',
    });
    await expect(page.locator('.annotation-circle')).toBeVisible();
    const pet = app.windows().find((w) => w.url().includes('/companion'))!;
    await expect(pet.locator('.yoyo-pointing')).toBeVisible();
    await page.evaluate(() =>
      window.yoteach.tutor.intent({ type: 'text', text: 'Can you give an example?' }),
    );
    await expect
      .poll(async () => {
        const s = await page.evaluate(() => window.yoteach.getState());
        return (
          s.ok && s.value.messages.some((m) => m.role === 'user' && m.text.includes('example'))
        );
      })
      .toBe(true);
    await provider.tool('save_explanation', { title: 'ATP activation' });
    await provider.tool('record_learning_interaction', { note: 'Asked about ATP investment.' });
    await provider.tool('navigate_slide', { page: 2 });
    await expect(page.getByText('Slide 2 / 5', { exact: true })).toBeVisible();
    await expect(page.locator('.lecture-slide-image img')).toBeVisible();

    mkdirSync('.impeccable/review', { recursive: true });
    await page.screenshot({ path: '.impeccable/review/lecture-fullscreen.png' });
    await page.getByRole('button', { name: 'Close lecture', exact: true }).click();
    await expect.poll(async () => (await runtime(page)).sessionId).toBeNull();
    expect((await runtime(page)).snapshot).toBeNull();
    await expect
      .poll(() =>
        app!.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('#/'))!
            .isFullScreen(),
        ),
      )
      .toBe(false);
    expect(errors).toEqual([]);
    await app.close();
    app = undefined;
    const next = await launch(dir);
    app = next.app;
    const saved = await next.page.evaluate(() => window.yoteach.getState());
    expect(saved.ok && saved.value.explanations[0].title).toBe('ATP activation');
    expect(saved.ok && saved.value.sessions[0].page).toBe(2);
    expect(saved.ok && saved.value.sessions[0].endedAt).toBeTruthy();
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('held microphone streams only while held, captures screen, cancels drag and stops on pause', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-hold-'));
  let app: ElectronApplication | undefined;
  try {
    const boot = await launch(dir);
    app = boot.app;
    const page = boot.page;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const provider = await fixtures(app, page);
    const button = page.getByRole('button', { name: 'Hold to speak', exact: true });
    await button.hover();
    await page.mouse.down();
    await expect.poll(async () => (await runtime(page)).input).toBe('listening');
    await expect.poll(async () => (await runtime(page)).snapshot?.source.kind).toBe('screen');
    // The question streams live while held, so little is left to send on release. No
    // user_activity: it postponed the server's end-of-turn check and lost questions.
    await expect.poll(() => provider.chunks()).toBeGreaterThan(0);
    const pet = app.windows().find((w) => w.url().includes('/companion'))!;
    await expect(pet.locator('.input-listening')).toBeVisible();
    // Wait for actual fixture audio, not wall time: a busy AudioContext can
    // deliver less than the speech detector's minimum during a fixed sleep.
    await expect
      .poll(() =>
        provider.messages.reduce(
          (bytes, m) =>
            bytes + (m.user_audio_chunk ? Buffer.from(m.user_audio_chunk, 'base64').length : 0),
          0,
        ),
      )
      .toBeGreaterThanOrEqual(16000 * 0.4 * 2);
    const held = provider.chunks();
    await page.mouse.up();
    await expect.poll(() => provider.chunks()).toBeGreaterThan(held);
    await expect.poll(async () => (await runtime(page)).input).toBe('idle');
    expect(provider.messages.filter((m) => m.type === 'user_activity')).toHaveLength(0);
    // Nothing more leaves once the hold is over.
    const after = provider.chunks();
    await page.waitForTimeout(600);
    expect(provider.chunks()).toBe(after);
    expect(
      await page.evaluate(() =>
        (window as any).__testStreams.every((s: MediaStream) =>
          s.getTracks().every((t) => t.readyState === 'ended'),
        ),
      ),
    ).toBe(true);
    expect(await app.evaluate(() => (globalThis as any).__captures)).toBe(1);
    const region = await provider.tool('analyze_current_screen', {
      question: 'Explain this region',
    });
    await pet.evaluate(async () => {
      await window.yoteach.drag({ phase: 'start', x: 400, y: 400 });
      await window.yoteach.drag({ phase: 'end', x: 430, y: 380 });
    });
    const base = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('/companion'))!
        .getBounds(),
    );
    await provider.tool('draw_annotation', {
      snapshotId: region.snapshotId,
      regionId: region.regions[0].regionId,
      shape: 'arrow',
    });
    const overlay = app.windows().find((w) => w.url().includes('/overlay'))!;
    await expect(overlay.locator('.annotation-arrow')).toBeVisible();
    await expect(pet.locator('.yoyo-pointing')).toBeVisible();
    await expect
      .poll(() =>
        app!.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().includes('/companion'))!
            .getBounds(),
        ),
      )
      .not.toEqual(base);
    await expect
      .poll(
        () =>
          app!.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()
              .find((w) => w.webContents.getURL().includes('/companion'))!
              .getBounds(),
          ),
        { timeout: 12000 },
      )
      .toEqual(base);
    const home = await page.evaluate(() => window.yoteach.getState());
    expect(home.ok && home.value.settings.mascotPosition).toEqual({ x: base.x, y: base.y });
    // The hidden workspace still owns audio while the desktop companion is used.
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('#/'))!
        .hide(),
    );
    // A drag cancels the next recording without sending audio.
    await pet.getByRole('button', { name: 'Hold Yoyo to speak, or drag to move' }).hover();
    await pet.mouse.down();
    await expect.poll(async () => (await runtime(page)).input).toBe('listening');
    const sent = provider.chunks();
    await pet.evaluate(async () => {
      await window.yoteach.drag({ phase: 'start', x: 500, y: 500 });
      await window.yoteach.drag({ phase: 'end', x: 510, y: 510 });
    });
    await pet.mouse.up();
    await expect.poll(async () => (await runtime(page)).input).toBe('idle');
    expect(provider.chunks()).toBe(sent);
    await pet.evaluate(() => window.yoteach.tutor.intent({ type: 'hold-start' }));
    await expect.poll(async () => (await runtime(page)).input).toBe('listening');
    await page.waitForTimeout(400);
    await pet.evaluate(() => window.yoteach.tutor.intent({ type: 'hold-end' }));
    await expect.poll(async () => (await runtime(page)).input).toBe('idle');
    expect(provider.chunks()).toBeGreaterThan(sent);
    provider.send({
      type: 'audio',
      audio_event: { audio_base_64: Buffer.alloc(32000).toString('base64'), event_id: 100 },
    });
    await expect(pet.locator('.yoyo--speaking')).toBeVisible();
    provider.send({ type: 'interruption', interruption_event: { event_id: 101 } });
    await expect(pet.locator('.yoyo--idle')).toBeVisible();
    await page.evaluate(() => window.yoteach.tutor.intent({ type: 'pause' }));
    expect((await runtime(page)).snapshot).toBeNull();
    expect(
      await page.evaluate(() =>
        (window as any).__testStreams.every((s: MediaStream) =>
          s.getTracks().every((t) => t.readyState === 'ended'),
        ),
      ),
    ).toBe(true);
    await page.evaluate(async () => {
      await Promise.all((window as any).__testContexts.map((c: AudioContext) => c.close()));
    });
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('proactive help: a screen held too long gets one on-device "Stuck?" offer', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-stuck-'));
  let app: ElectronApplication | undefined;
  try {
    // Shortened timings; the real ones are a 30 s check and 75 s or more on one screen.
    const boot = await launch(dir, {
      YOTEACH_STUCK_TICK_MS: '300',
      YOTEACH_STUCK_AFTER_MS: '1500',
      YOTEACH_STUCK_IGNORE_IDLE: '1',
    });
    app = boot.app;
    await fixtures(app, boot.page);
    await app.evaluate(({ BrowserWindow }) => {
      (globalThis as any).__requests = [];
      const original = globalThis.fetch;
      globalThis.fetch = async (...args) => {
        (globalThis as any).__requests.push(String(args[0]));
        return original(...args);
      };
      // Yoteach itself in front means the student is using the app, not stuck on something.
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('#/'))!
        .hide();
    });
    const pet = app.windows().find((w) => w.url().includes('/companion'))!;
    // A full-screen video (no text) is never "stuck".
    await pet.waitForTimeout(2500);
    await expect(pet.locator('.companion-notice')).toHaveCount(0);
    // A short problem that stays put earns the offer.
    await app.evaluate(() => {
      (globalThis as any).__captureWords = 'Find the derivative of x squared plus three x'.split(
        ' ',
      );
    });
    await expect(pet.locator('.companion-notice')).toHaveText(
      /Stuck on this one\? Hold .+ and ask me\./,
      {
        timeout: 6000,
      },
    );
    // Only screenshots and on-device text recognition ran: nothing went over the network.
    expect(await app.evaluate(() => (globalThis as any).__requests)).toEqual([]);
    expect(await app.evaluate(() => (globalThis as any).__captures)).toBeGreaterThan(5);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('failed voice startup releases listening and the next hold can connect', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-retry-'));
  let app: ElectronApplication | undefined;
  try {
    const boot = await launch(dir);
    app = boot.app;
    const page = boot.page;
    const provider = await fixtures(app, page);
    await app.evaluate(() => {
      const original = globalThis.fetch;
      let fail = true;
      globalThis.fetch = async (...args) => {
        if (fail && String(args[0]).includes('get-signed-url')) {
          fail = false;
          return new Response('Unavailable', { status: 503 });
        }
        return original(...args);
      };
    });
    await page.evaluate(() => window.yoteach.tutor.intent({ type: 'hold-start' }));
    await expect.poll(async () => (await runtime(page)).input).toBe('idle');
    await expect.poll(async () => (await runtime(page)).sessionId).toBeNull();
    const pet = app.windows().find((w) => w.url().includes('/companion'))!;
    await expect(pet.locator('.input-listening')).toHaveCount(0);
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.evaluate(() => window.yoteach.tutor.intent({ type: 'hold-end' }));
    expect((await runtime(page)).input).toBe('idle');
    await page.evaluate(() => window.yoteach.tutor.intent({ type: 'hold-start' }));
    await expect.poll(async () => (await runtime(page)).input).toBe('listening');
    await page.waitForTimeout(300);
    await page.evaluate(() => window.yoteach.tutor.intent({ type: 'hold-end' }));
    await expect.poll(() => provider.chunks()).toBeGreaterThan(0);
    await expect.poll(async () => (await runtime(page)).input).toBe('idle');
    await page.evaluate(() => window.yoteach.tutor.intent({ type: 'end' }));
    expect(
      await page.evaluate(() =>
        (window as any).__testStreams.every((s: MediaStream) =>
          s.getTracks().every((t) => t.readyState === 'ended'),
        ),
      ),
    ).toBe(true);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Yoyo teaches on the screen: draws on regions, sketches, celebrates, and captures each held question', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-screen-'));
  let app: ElectronApplication | undefined;
  try {
    const boot = await launch(dir);
    app = boot.app;
    const page = boot.page;
    const provider = await fixtures(app, page);
    await page.evaluate(() =>
      window.yoteach.tutor.intent({ type: 'start', topicId: null, mode: 'voice' }),
    );
    await expect.poll(async () => (await runtime(page)).status).toBe('connected');
    const layer = app.windows().find((w) => w.url().includes('/overlay'))!;
    const overlayVisible = () =>
      app!.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes('/overlay'))!
          .isVisible(),
      );
    const workspaceFocused = () =>
      app!.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('#/'))!
          .isFocused(),
      );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('#/'))!
        .blur(),
    );
    // A held question captures the screen; Yoyo analyzes it and draws on it.
    const hold = page.getByRole('button', { name: 'Hold to speak', exact: true });
    await hold.hover();
    await page.mouse.down();
    await expect.poll(async () => (await runtime(page)).input).toBe('listening');
    await page.waitForTimeout(250);
    await page.mouse.up();
    await expect.poll(async () => (await runtime(page)).snapshot?.source.kind).toBe('screen');
    const analysis = await provider.tool('analyze_current_screen', {
      question: 'Where is the investment?',
    });
    const region = analysis.regions[0].regionId;
    await provider.tool('draw_on_screen', {
      marks: [{ regionId: region, shape: 'circle', label: 'ATP is spent here' }],
      connections: [],
      clear: true,
    });
    await expect.poll(overlayVisible).toBe(true);
    await expect(layer.locator('.mark-circle path.ink:not(.leader)')).toHaveCount(1);
    await expect(layer.locator('.ink-label', { hasText: 'ATP is spent here' })).toBeVisible();
    await provider.tool('sketch_diagram', {
      diagram: {
        title: 'Investment then payoff',
        layout: 'flow',
        nodes: [
          { id: 'glucose', label: 'Glucose' },
          { id: 'invest', label: '2 ATP invested' },
          { id: 'payoff', label: '4 ATP made' },
        ],
        edges: [
          { from: 'glucose', to: 'invest' },
          { from: 'invest', to: 'payoff', label: 'net +2' },
        ],
      },
    });
    await expect(layer.getByRole('img', { name: 'Investment then payoff' })).toBeVisible();
    await expect(layer.locator('.diagram-node')).toHaveCount(3);
    // Yoyo flies beside what it just drew, and celebrates when asked.
    const petBounds = () =>
      app!.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes('/companion'))!
          .getBounds(),
      );
    const before = await petBounds();
    await provider.tool('sketch_on_screen', {
      title: 'Head to tail',
      elements: [
        { type: 'arrow', from: [10, 60], to: [45, 30], label: 'A' },
        { type: 'arrow', from: [45, 30], to: [85, 50], label: 'B' },
      ],
    });
    await expect
      .poll(async () => JSON.stringify(await petBounds()))
      .not.toBe(JSON.stringify(before));
    // Real pictures, alive: a neuron with a travelling pulse and ions flowing in and out.
    await provider.tool('sketch_on_screen', {
      title: 'A neuron fires',
      size: 'large',
      captions: [
        'The cell body collects input',
        'The signal races down the axon',
        'Na+ rushes in, K+ leaks out',
      ],
      elements: [
        {
          type: 'shape',
          points: [
            [8, 30],
            [16, 20],
            [26, 24],
            [28, 36],
            [18, 42],
          ],
          fill: 'pink',
          tone: 'pink',
          label: 'soma',
          step: 1,
        },
        {
          type: 'curve',
          points: [
            [10, 22],
            [4, 12],
            [2, 6],
          ],
          step: 1,
        },
        {
          type: 'curve',
          points: [
            [12, 40],
            [6, 50],
            [3, 58],
          ],
          step: 1,
        },
        {
          type: 'curve',
          points: [
            [28, 31],
            [55, 33],
            [90, 31],
          ],
          width: 3,
          tone: 'blue',
          label: 'axon',
          step: 2,
        },
        {
          type: 'pulse',
          path: [
            [28, 31],
            [55, 33],
            [90, 31],
          ],
          seconds: 1.6,
          tone: 'yellow',
          step: 2,
        },
        {
          type: 'flow',
          path: [
            [50, 10],
            [50, 30],
          ],
          symbol: 'Na+',
          count: 4,
          tone: 'green',
          step: 3,
        },
        {
          type: 'flow',
          path: [
            [66, 32],
            [66, 56],
          ],
          symbol: 'K+',
          count: 4,
          tone: 'accent',
          step: 3,
        },
      ],
    });
    await expect(layer.getByRole('img', { name: 'A neuron fires' })).toBeVisible();
    await expect(layer.locator('.flow .particle')).toHaveCount(8);
    await expect(layer.locator('.pulse-band')).toHaveCount(1);
    await layer.waitForTimeout(4200);
    mkdirSync('.impeccable/review', { recursive: true });
    await layer.screenshot({ path: '.impeccable/review/neuron-sketch.png' });
    // Cursor ink: the trace the cursor leaves while the talk key is held.
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((x) =>
        x.webContents.getURL().includes('/overlay'),
      )!;
      const points = Array.from({ length: 80 }, (_, k) => {
        const a = (k / 70) * 2 * Math.PI;
        return { x: 0.3 + 0.07 * Math.cos(a), y: 0.3 + 0.06 * Math.sin(a), t: k * 16 };
      });
      w.webContents.send('overlay:trail', { type: 'start', points });
    });
    await layer.waitForTimeout(150);
    await expect
      .poll(() =>
        layer.locator('canvas.cursor-ink').evaluate((c: HTMLCanvasElement) => {
          const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
          let n = 0;
          for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++;
          return n;
        }),
      )
      .toBeGreaterThan(50);
    await layer.screenshot({ path: '.impeccable/review/cursor-ink.png' });
    const companion = app.windows().find((w) => w.url().includes('/companion'))!;
    await provider.tool('celebrate', { reason: 'understood vector addition' });
    await expect(companion.locator('.yoyo--success')).toBeVisible();
    await expect(companion.locator('.yoyo-burst i')).toHaveCount(10);
    await expect(companion.locator('.yoyo--success')).toHaveCount(0, { timeout: 5000 });
    mkdirSync('.impeccable/review', { recursive: true });
    await layer.screenshot({ path: '.impeccable/review/on-screen-teaching.png' });
    // A held question captures a fresh still of the screen.
    const captures = await app.evaluate(() => (globalThis as any).__captures ?? 0);
    await hold.hover();
    await page.mouse.down();
    await expect.poll(async () => (await runtime(page)).input).toBe('listening');
    await page.waitForTimeout(250);
    await page.mouse.up();
    await expect
      .poll(() => app!.evaluate(() => (globalThis as any).__captures ?? 0))
      .toBe(captures + 1);
    await expect
      .poll(() =>
        provider.messages.some(
          (m) => m.type === 'contextual_update' && String(m.text).includes('fresh still'),
        ),
      )
      .toBe(true);
    expect(await workspaceFocused()).toBe(false);
    await provider.tool('clear_screen');
    await expect.poll(overlayVisible).toBe(false);
    await page.evaluate(() => window.yoteach.tutor.intent({ type: 'end' }));
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('images Yoyo makes with fal show progress, explain failure and survive restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-fal-'));
  let app: ElectronApplication | undefined;
  // Fixture only: scripted fal queue in the isolated main process. The CDN serves a committed PNG.
  const installFal = (target: ElectronApplication, png: string) =>
    target.evaluate((_electron, png) => {
      const fs = process.getBuiltinModule('node:fs')!;
      const g = globalThis as any;
      g.falCalls = [];
      g.falMode = 'ok';
      let polls = 0;
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      const previous = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        const url = String(input),
          auth = new Headers(init?.headers).get('authorization');
        g.falCalls.push({ url, auth });
        const base = 'https://queue.fal.run/fal-ai/flux/requests/fixture-1';
        if (url === 'https://queue.fal.run/fal-ai/flux/schnell') {
          if (g.falMode === 'credit') return json({ detail: 'Exhausted balance' }, 402);
          polls = 0;
          return json({
            request_id: 'fixture-1',
            status_url: base + '/status',
            response_url: base,
            cancel_url: base + '/cancel',
            queue_position: 1,
          });
        }
        if (url === base + '/status') {
          await new Promise((r) => setTimeout(r, 400));
          return json(
            polls++ < 2 ? { status: 'IN_QUEUE', queue_position: 1 } : { status: 'COMPLETED' },
          );
        }
        if (url === base)
          return json({
            images: [
              {
                url: 'https://v3.fal.media/files/fixture/analogy.png',
                width: 1024,
                height: 1024,
                content_type: 'image/png',
              },
            ],
            has_nsfw_concepts: [false],
          });
        if (url === 'https://v3.fal.media/files/fixture/analogy.png')
          return new Response(fs.readFileSync(png), { headers: { 'content-type': 'image/png' } });
        if (url.includes('fal.'))
          throw new Error('Unexpected live request in fixture test: ' + url);
        return previous(input, init);
      };
    }, png);
  const png = resolve('assets/icons/yoyo.png');
  try {
    let boot = await launch(dir);
    app = boot.app;
    let page = boot.page;
    const provider = await fixtures(app, page);
    await installFal(app, png);
    await page.evaluate(() =>
      window.yoteach.tutor.intent({ type: 'start', topicId: null, mode: 'voice' }),
    );
    await expect.poll(async () => (await runtime(page)).status).toBe('connected');
    const layer = app.windows().find((w) => w.url().includes('/overlay'))!;
    const subject =
      'a small glowing orb handed from a battery to a hexagonal tile like a relay baton';
    await provider.tool('generate_illustration', { subject, kind: 'image' });
    await expect(layer.getByText(/Waiting in fal’s queue/)).toBeVisible();
    await expect(layer.getByRole('heading', { name: 'Made by Yoyo' })).toBeVisible();
    const image = layer.getByRole('img', { name: /AI-generated image: a small glowing orb/ });
    await expect(image).toBeVisible({ timeout: 15000 });
    await expect.poll(() => image.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1024);
    await expect(layer.getByText('illustrative, not a precise diagram')).toBeVisible();
    const calls = await app.evaluate(
      () => (globalThis as any).falCalls as { url: string; auth: string | null }[],
    );
    expect(calls.filter((c) => c.url.includes('fal.media')).every((c) => c.auth === null)).toBe(
      true,
    );
    expect(
      calls
        .filter((c) => c.url.startsWith('https://queue.fal.run/'))
        .every((c) => c.auth === 'Key test-only-fal'),
    ).toBe(true);
    mkdirSync('.impeccable/review', { recursive: true });
    await layer.screenshot({ path: '.impeccable/review/made-by-yoyo.png' });
    // A failure explains itself.
    await layer.getByRole('button', { name: 'Close', exact: true }).click();
    await app.evaluate(() => {
      (globalThis as any).falMode = 'credit';
    });
    await provider.tool('generate_illustration', { subject: 'a second scene', kind: 'image' });
    await expect(layer.getByRole('alert').filter({ hasText: /no available credit/ })).toBeVisible();
    await page.evaluate(() => window.yoteach.tutor.intent({ type: 'end' }));
    await app.close();
    app = undefined;
    boot = await launch(dir);
    app = boot.app;
    page = boot.page;
    await page.getByRole('button', { name: 'Saved material', exact: true }).click();
    await page.getByRole('button', { name: /^Image · a small glowing orb/ }).click();
    await expect(
      page.getByRole('dialog').getByRole('img', { name: /AI-generated image/ }),
    ).toBeVisible();
    await expect(page.getByText('requested by Yoyo')).toBeVisible();
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Adds a fal fixture on top of the existing provider fixture. */
async function generatedFixtures(app: ElectronApplication, png: string) {
  await app.evaluate((_electron, png) => {
    const fs = process.getBuiltinModule('node:fs')!;
    const g = globalThis as any,
      previous = globalThis.fetch;
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    const base = 'https://queue.fal.run/fal-ai/flux/requests/demo-1';
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url === 'https://queue.fal.run/fal-ai/flux/schnell')
        return json({ request_id: 'demo-1', status_url: base + '/status', response_url: base });
      if (url === base + '/status') return json({ status: 'COMPLETED' });
      if (url === base)
        return json({
          images: [{ url: 'https://v3.fal.media/files/demo/a.png', width: 1024, height: 1024 }],
          has_nsfw_concepts: [false],
        });
      if (url === 'https://v3.fal.media/files/demo/a.png')
        return new Response(fs.readFileSync(png), { headers: { 'content-type': 'image/png' } });
      return previous(input, init);
    };
  }, png);
}

test('Stage 3 demo: lecture → fal media → saved restart → replay', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-demo-'));
  let app: ElectronApplication | undefined;
  try {
    let boot = await launch(dir);
    app = boot.app;
    let page = boot.page;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const provider = await fixtures(app, page);
    await generatedFixtures(app, resolve('assets/icons/yoyo.png'));
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    }, resolve('public/sample-lecture.pdf'));
    // 1. Lecture explanation of energy investment.
    await page.getByRole('button', { name: 'Lectures', exact: true }).click();
    await page.getByRole('button', { name: /Upload a lecture PDF/ }).click();
    await page.getByRole('button', { name: 'Run me through the lecture', exact: true }).click();
    await expect(page.locator('.lecture-slide-image img')).toBeVisible();
    await expect
      .poll(async () => {
        const s = await page.evaluate(() => window.yoteach.getState());
        return s.ok && s.value.messages.some((m) => m.role === 'assistant');
      })
      .toBe(true);
    await provider.tool('save_explanation', { title: 'Why ATP is invested' });
    // 2. A genuine fal request path (fixture queue), shown in the lecture and saved.
    const started = await provider.tool('generate_illustration', {
      subject: 'a small glowing orb handed from a battery to a hexagonal tile like a relay baton',
      kind: 'image',
    });
    expect(started.started).toBe(true);
    await expect(page.getByRole('img', { name: /AI-generated (image|clip)/ })).toBeVisible();
    await expect
      .poll(() =>
        provider.messages.some(
          (m) => m.type === 'contextual_update' && String(m.text).includes('is now displayed'),
        ),
      )
      .toBe(true);
    await page.getByRole('button', { name: 'Close lecture', exact: true }).click();
    // 3. Restart: everything is still there.
    await app.close();
    app = undefined;
    boot = await launch(dir);
    app = boot.app;
    page = boot.page;
    await page.getByRole('button', { name: 'Saved material', exact: true }).click();
    const saved = page.getByRole('dialog');
    await expect(saved.getByRole('heading', { name: 'Why ATP is invested' })).toBeVisible();
    await expect(saved.getByRole('button', { name: /^Image · a small glowing orb/ })).toBeVisible();
    await page.screenshot({ path: '.impeccable/review/saved-after-restart.png' });
    await page.screenshot({ path: 'docs/overnight/cycle-4/after.png' });
    expect(await saved.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(saved.getByRole('button', { name: 'Unsave', exact: true })).toBeInViewport();
    expect(
      await saved.evaluate((el) => {
        const dialog = el.getBoundingClientRect();
        return Array.from(el.querySelectorAll('button')).every((button) => {
          const box = button.getBoundingClientRect();
          return box.left >= dialog.left && box.right <= dialog.right;
        });
      }),
    ).toBe(true);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    // The walkthrough replays from saved history: slide, what Yoyo said, and its drawings.
    await page.getByRole('button', { name: 'Lectures', exact: true }).click();
    const walk = page.locator('.walkthrough', { hasText: 'sample-lecture.pdf' });
    await expect(walk).toBeVisible();
    await walk.getByRole('button', { name: /Replay/ }).click();
    await page.getByRole('button', { name: 'Mute narration' }).click();
    await expect(page.locator('.replay-slide img')).toBeVisible();
    await expect(page.locator('.replay-caption')).toContainText('ATP activates glucose');
    await expect(page.getByText(/Slide \d+ · 1\//)).toBeVisible();
    await page.screenshot({ path: '.impeccable/review/lecture-replay.png' });
    await page.getByRole('button', { name: 'Close replay' }).click();
    await page.screenshot({ path: 'docs/overnight/cycle-2/before.png' });
    await walk.getByRole('button', { name: /Delete walkthrough/ }).click();
    const confirmation = page.getByRole('dialog', { name: /Delete walkthrough/ });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText('Your PDF stays in Saved material');
    await page.screenshot({ path: 'docs/overnight/cycle-2/after.png' });
    await page.keyboard.press('Escape');
    await expect(walk).toBeVisible();
    await walk.getByRole('button', { name: /Delete walkthrough/ }).click();
    await confirmation.getByRole('button', { name: 'Keep walkthrough' }).click();
    await expect(walk).toBeVisible();
    await walk.getByRole('button', { name: /Delete walkthrough/ }).click();
    await confirmation.getByRole('button', { name: 'Delete walkthrough', exact: true }).click();
    await expect(walk).toHaveCount(0);
    const remaining = await page.evaluate(() => window.yoteach.getState());
    expect(
      remaining.ok &&
        remaining.value.documents.some((d) => d.originalName === 'sample-lecture.pdf'),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('flow particles stay separated on short paths and respect live reduced-motion changes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-flow-'));
  let app: ElectronApplication | undefined;
  try {
    const boot = await launch(dir);
    app = boot.app;
    const provider = await fixtures(app, boot.page);
    await boot.page.evaluate(() =>
      window.yoteach.tutor.intent({ type: 'start', topicId: null, mode: 'voice' }),
    );
    await expect.poll(async () => (await runtime(boot.page)).status).toBe('connected');
    const layer = app.windows().find((w) => w.url().includes('/overlay'))!;
    await layer.emulateMedia({ reducedMotion: 'reduce' });
    await provider.tool('sketch_on_screen', {
      title: 'Sodium crosses the membrane',
      elements: [
        { type: 'line', from: [45, 15], to: [45, 55], tone: 'muted' },
        {
          type: 'flow',
          path: [
            [30, 35],
            [60, 35],
          ],
          symbol: 'Na+',
          count: 12,
          seconds: 3,
          tone: 'blue',
        },
        { type: 'text', at: [24, 20], text: 'Outside' },
        { type: 'text', at: [55, 20], text: 'Inside' },
      ],
    });
    await expect(layer.getByRole('img', { name: 'Sodium crosses the membrane' })).toBeVisible();
    await layer.evaluate(() => document.fonts.ready);
    await expect(layer.locator('figcaption span i').first()).toHaveCSS('opacity', '1');
    await layer.waitForTimeout(1200); // Allow the native transparent window to paint.
    const phase = process.env.YOTEACH_EVIDENCE_PHASE ?? 'after';
    await layer.screenshot({ path: `docs/overnight/cycle-1/${phase}.png` });
    const positions = () =>
      layer
        .locator('.flow .particle:visible')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('transform')));
    await expect(layer.locator('.flow')).toHaveCSS('opacity', '1');
    const still = await positions();
    expect(new Set(still).size).toBe(still.length);
    expect(still.length).toBeGreaterThan(1);
    expect(still.length).toBeLessThan(12);
    await layer.waitForTimeout(150);
    expect(await positions()).toEqual(still);
    await layer.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(positions).not.toEqual(still);
    await layer.emulateMedia({ reducedMotion: 'reduce' });
    await layer.waitForTimeout(100);
    const stopped = await positions();
    await layer.waitForTimeout(150);
    expect(await positions()).toEqual(stopped);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('recorded live answers render across twelve subjects', async () => {
  const rows = JSON.parse(readFileSync('docs/overnight/live/after.json', 'utf8'));
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-subjects-'));
  let app: ElectronApplication | undefined;
  try {
    const boot = await launch(dir);
    app = boot.app;
    const provider = await fixtures(app, boot.page);
    await boot.page.evaluate(() =>
      window.yoteach.tutor.intent({ type: 'start', topicId: null, mode: 'voice' }),
    );
    await expect.poll(async () => (await runtime(boot.page)).status).toBe('connected');
    const layer = app.windows().find((w) => w.url().includes('/overlay'))!;
    await layer.emulateMedia({ reducedMotion: 'reduce' });
    for (const row of rows) {
      await provider.tool('clear_screen');
      for (const call of row.tools) await provider.tool(call.name, call.parameters);
      await expect(layer.locator('.sketch-canvas')).toBeVisible();
      await layer.evaluate(() => document.fonts.ready);
      await layer.waitForTimeout(400);
      await layer
        .locator('.sketch-canvas')
        .screenshot({ path: `docs/overnight/live/sketch-${row.subject}.png` });
      await expect(layer.locator('.sketch-canvas svg[role="img"]')).toHaveAttribute(
        'aria-label',
        /.+/,
      );
    }
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('explanatory videos use timed shots, seekable captions, and persist their lesson', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-video-'));
  let app: ElectronApplication | undefined;
  const lesson = {
    objective: 'A signal acts on a nearby cell.',
    scene: 'Blue cell on the left, orange cell on the right, with a gap between them.',
    steps: [
      {
        caption: 'The cell releases a signal.',
        action: 'Yellow dots leave the blue cell and enter the gap.',
      },
      {
        caption: 'The signal diffuses locally.',
        action: 'Yellow dots move through the gap toward the orange cell.',
      },
      {
        caption: 'Receptors trigger a response.',
        action: 'Dots bind the orange cell receptors and an internal green patch appears.',
      },
    ],
  };
  try {
    const boot = await launch(dir, { FAL_VIDEO_MODEL: 'fal-ai/kling-video/v3/pro/text-to-video' });
    app = boot.app;
    const page = boot.page;
    const provider = await fixtures(app, page);
    await app.evaluate(
      (_, { lesson, file }) => {
        const previous = globalThis.fetch;
        const json = (data: unknown) => new Response(JSON.stringify(data));
        globalThis.fetch = async (input, init) => {
          const url = String(input);
          if (
            url.includes('api.anthropic.com') &&
            String(init?.body).includes('Plan an accurate educational animation')
          )
            return json({ content: [{ type: 'text', text: JSON.stringify(lesson) }] });
          if (url === 'https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video') {
            (globalThis as any).__videoInput = JSON.parse(String(init?.body));
            return json({ request_id: 'lesson-test' });
          }
          if (url.endsWith('/lesson-test/status')) return json({ status: 'COMPLETED' });
          if (url.endsWith('/requests/lesson-test'))
            return json({
              video: { url: 'https://fal.media/lesson-test.mp4', width: 320, height: 180 },
            });
          if (url === 'https://fal.media/lesson-test.mp4')
            return new Response(process.getBuiltinModule('node:fs')!.readFileSync(file));
          return previous(input, init);
        };
      },
      { lesson, file: resolve('tests/fixtures/lesson.mp4') },
    );
    await page.evaluate(() =>
      window.yoteach.tutor.intent({ type: 'start', topicId: null, mode: 'voice' }),
    );
    await expect.poll(async () => (await runtime(page)).status).toBe('connected');
    await provider.tool('generate_illustration', {
      subject: 'Explain paracrine signaling',
      kind: 'video',
    });
    const layer = app.windows().find((w) => w.url().includes('/overlay'))!;
    const video = layer.locator('video');
    await expect(video).toBeVisible({ timeout: 15000 });
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => Number.isFinite(v.duration)))
      .toBe(true);
    await expect(layer.locator('.video-lesson-caption')).toHaveText(
      '1/3 · The cell releases a signal.',
    );
    await video.evaluate((v: HTMLVideoElement) => {
      v.currentTime = v.duration * 0.8;
    });
    await expect(layer.locator('.video-lesson-caption')).toHaveText(
      '3/3 · Receptors trigger a response.',
    );
    await layer.getByText('Explanation steps', { exact: true }).click();
    await layer.getByRole('button', { name: 'The signal diffuses locally.' }).click();
    await expect(layer.locator('.video-lesson-caption')).toHaveText(
      '2/3 · The signal diffuses locally.',
    );
    const input = await app.evaluate(() => (globalThis as any).__videoInput);
    expect(input.duration).toBe('15');
    expect(input.prompt).toBeUndefined();
    expect(input.multi_prompt).toHaveLength(3);
    expect(input.multi_prompt.every((p: any) => p.duration === '5' && p.prompt.length <= 512)).toBe(
      true,
    );
    mkdirSync('.impeccable/review', { recursive: true });
    await layer
      .locator('.screen-card')
      .screenshot({ path: '.impeccable/review/video-captions.png' });
    const tether = page.locator('.yoyo-v2-tether').first();
    await expect(tether).toHaveCSS('stroke', 'rgb(0, 0, 0)');
    await expect(tether).toHaveCSS('stroke-width', '3.4px');
    await page
      .locator('.sidebar-companion')
      .screenshot({ path: '.impeccable/review/yoyo-string.png' });
    await app.close();
    app = undefined;
    const { Store } = await import('../electron/store');
    expect(new Store(dir).snapshot().media[0].lesson).toEqual(lesson);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
