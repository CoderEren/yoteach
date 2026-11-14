import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
  type WebSocketRoute,
} from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
async function launch(dir: string) {
  const env = {
    ...process.env,
    YOTEACH_DATA_DIR: dir,
    ELEVENLABS_API_KEY: 'test-only-key',
    ELEVENLABS_AGENT_ID: 'test-only-agent',
    ANTHROPIC_API_KEY: 'test-only-vision',
    FAL_KEY: 'test-only-fal',
    FAL_IMAGE_MODEL: 'fal-ai/flux/schnell',
    FAL_VIDEO_MODEL: '',
  } as Record<string, string>;
  delete env.ELECTRON_RUN_AS_NODE;
  if (process.env.YOTEACH_TEST_DEV === '1') env.YOTEACH_DEV_URL = 'http://127.0.0.1:5173';
  else delete env.YOTEACH_DEV_URL;
  const app = await electron.launch({ args: ['.'], env });
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('#/'))).toBe(true);
  const page = app.windows().find((w) => w.url().endsWith('#/'))!;
  await expect(page.getByRole('heading', { name: 'Let’s work through it.' })).toBeVisible();
  return { app, page };
}
async function fixtures(app: ElectronApplication, page: Page) {
  await app.evaluate(({ systemPreferences }) => {
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
            image: 'data:image/jpeg;base64,/9j/',
            width: 1200,
            height: 800,
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
    await page.getByRole('button', { name: 'Lecture walkthrough', exact: true }).click();
    await page.getByRole('button', { name: /Upload your lecture/ }).click();
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
          (m) => m.type === 'user_message' && m.text.includes('Run me through'),
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
    await provider.tool('open_visual_lesson', { lesson: 'glucose-phosphorylation', step: 3 });
    await expect(page.getByRole('slider', { name: 'Phosphate transfer' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to lecture', exact: true }).click();
    await expect(page.locator('.lecture-slide-image img')).toBeVisible();
    await expect(page.getByText('Slide 2 / 5', { exact: true })).toBeVisible();

    mkdirSync('.impeccable/review', { recursive: true });
    await page.screenshot({ path: '.impeccable/review/lecture-fullscreen.png' });
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
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

test('held microphone buffers until release, captures screen, cancels drag and stops on pause', async () => {
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
    await page.waitForTimeout(450);
    expect(provider.chunks()).toBe(0);
    const pet = app.windows().find((w) => w.url().includes('/companion'))!;
    await expect(pet.locator('.input-listening')).toBeVisible();
    await page.mouse.up();
    await expect.poll(() => provider.chunks()).toBeGreaterThan(0);
    await expect.poll(async () => (await runtime(page)).input).toBe('idle');
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

test('authored visual lesson supports keyboard, manipulation, playback and saved restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-visual-'));
  let app: ElectronApplication | undefined;
  try {
    let boot = await launch(dir);
    app = boot.app;
    let page = boot.page;
    await page.getByRole('button', { name: /Why invest ATP in glucose/ }).click();
    await expect(page.getByRole('heading', { name: 'Why invest ATP in glucose?' })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(
      page.getByRole('heading', { name: 'Hexokinase brings the partners together' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    const slider = page.getByRole('slider', { name: 'Phosphate transfer' });
    await slider.fill('100');
    await expect(page.getByText('Transferred', { exact: true })).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.screenshot({ path: '.impeccable/review/visual-lesson-transfer.png' });
    await page.getByRole('button', { name: 'Replay lesson', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Start with glucose and ATP' })).toBeVisible();
    await page.clock.install();
    await page.getByRole('button', { name: 'Play lesson', exact: true }).click();
    await page.clock.fastForward(9100);
    await expect(
      page.getByRole('heading', { name: 'Hexokinase brings the partners together' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Pause lesson', exact: true }).click();
    await page.clock.fastForward(10000);
    await expect(
      page.getByRole('heading', { name: 'Hexokinase brings the partners together' }),
    ).toBeVisible();
    await app.close();
    app = undefined;
    boot = await launch(dir);
    app = boot.app;
    page = boot.page;
    await page.getByRole('button', { name: 'Saved material', exact: true }).click();
    await page.getByRole('button', { name: /Why invest ATP in glucose.*Step 2/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Hexokinase brings the partners together' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to tutor', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Let’s work through it.' })).toBeVisible();
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Yoyo teaches on the screen: draws on regions, sketches, and opens lesson and practice cards there', async () => {
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
    await expect(layer.locator('.mark-circle ellipse')).toHaveCount(1);
    await expect(layer.locator('.mark-label', { hasText: 'ATP is spent here' })).toBeVisible();
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
    // The lesson opens as a card on the screen, not in the app.
    const opened = await provider.tool('open_visual_lesson', {
      lesson: 'glucose-phosphorylation',
      step: 3,
    });
    expect(opened.scene).toBe('transfer');
    await expect(
      layer.getByRole('heading', { name: 'Follow the terminal phosphate' }),
    ).toBeVisible();
    await expect(layer.getByRole('slider', { name: 'Phosphate transfer' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Let’s work through it.' })).toBeVisible();
    await provider.tool('navigate_visual_lesson', { step: 4 });
    await expect(layer.getByRole('heading', { name: 'Meet the products' })).toBeVisible();
    await layer.getByRole('button', { name: 'Explain', exact: true }).click();
    await expect
      .poll(() =>
        provider.messages.some(
          (m) => m.type === 'user_message' && m.text.includes('visual lesson step'),
        ),
      )
      .toBe(true);
    await layer.getByRole('button', { name: 'Next step', exact: true }).click();
    await expect(
      layer.getByRole('heading', { name: 'Retain and prepare the sugar' }),
    ).toBeVisible();
    // Practice on the same card; a written question is answered aloud.
    await provider.tool('ask_practice_question', { question: 'energy-source' });
    await expect(
      layer.getByRole('heading', { name: /Why is phosphorylating glucose/ }),
    ).toBeVisible();
    await expect(layer.getByText(/Hold your talk key or Yoyo and say your answer/)).toBeVisible();
    await layer.getByRole('tab', { name: 'Question 5' }).click();
    await layer.getByLabel('Four ATP').check();
    await layer.getByRole('button', { name: 'Check answer', exact: true }).click();
    await expect(
      layer.getByText('Possible misconception: Glycolysis nets four ATP per glucose.').first(),
    ).toBeVisible();
    await expect
      .poll(() =>
        provider.messages.some(
          (m) => m.type === 'contextual_update' && String(m.text).includes('practice question'),
        ),
      )
      .toBe(true);
    mkdirSync('.impeccable/review', { recursive: true });
    await layer.screenshot({ path: '.impeccable/review/on-screen-teaching.png' });
    // A held question with the card open captures the screen and includes the card context.
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
          (m) =>
            m.type === 'contextual_update' && String(m.text).includes('lesson card is also open'),
        ),
      )
      .toBe(true);
    expect(await workspaceFocused()).toBe(false);
    await layer.getByRole('button', { name: 'Back to lesson' }).first().click();
    await layer.getByRole('button', { name: 'Close lesson', exact: true }).click();
    await provider.tool('clear_screen');
    await expect.poll(overlayVisible).toBe(false);
    await page.evaluate(() => window.yoteach.tutor.intent({ type: 'end' }));
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fal visual analogy shows progress, saves with the lesson step, explains failure and survives restart', async () => {
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
        throw new Error('Unexpected live request in fixture test: ' + url);
      };
    }, png);
  const png = resolve('assets/icons/yoyo.png');
  try {
    let boot = await launch(dir);
    app = boot.app;
    let page = boot.page;
    await installFal(app, png);
    await page.getByRole('button', { name: /Why invest ATP in glucose/ }).click();
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Follow the terminal phosphate' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Generate visual analogy', exact: true }).click();
    await expect(page.getByText(/Waiting in fal’s queue/)).toBeVisible();
    const image = page.getByRole('img', {
      name: /AI-generated visual analogy: a small glowing orb/,
    });
    await expect(image).toBeVisible({ timeout: 15000 });
    await expect.poll(() => image.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1024);
    await expect(page.getByText('not a scientific diagram')).toBeVisible();
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
    await page.screenshot({ path: '.impeccable/review/visual-lesson-fal.png' });
    // Another step has its own media; a failure explains itself and offers a retry.
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    await expect(page.getByRole('img', { name: /AI-generated visual analogy/ })).toHaveCount(0);
    await app.evaluate(() => {
      (globalThis as any).falMode = 'credit';
    });
    await page.getByRole('button', { name: 'Generate visual analogy', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /no available credit/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Retry/ })).toBeVisible();
    await app.close();
    app = undefined;
    boot = await launch(dir);
    app = boot.app;
    page = boot.page;
    await page.getByRole('button', { name: 'Saved material', exact: true }).click();
    await page.getByRole('button', { name: /Visual analogy · Lesson step 3/ }).click();
    await expect(
      page.getByRole('dialog').getByRole('img', { name: /AI-generated visual analogy/ }),
    ).toBeVisible();
    await expect(page.getByText('requested by you')).toBeVisible();
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Adds fal and practice-grading fixtures on top of the existing provider fixture. */
async function generatedFixtures(app: ElectronApplication, png: string) {
  await app.evaluate((_electron, png) => {
    const fs = process.getBuiltinModule('node:fs')!;
    const g = globalThis as any,
      previous = globalThis.fetch;
    g.gradeRequests = [];
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
      const body = typeof init?.body === 'string' ? init.body : '';
      if (url === 'https://api.anthropic.com/v1/messages' && body.includes('one practice answer')) {
        const request = JSON.parse(body);
        g.gradeRequests.push(JSON.parse(request.messages[0].content));
        return json({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                verdict: 'partial',
                feedback:
                  'Good: the early steps prepare glucose. But four is the total made; two were invested, so the net gain is two.',
                misconceptions: [{ id: 'gross-as-net', evidence: 'nets four ATP' }],
              }),
            },
          ],
        });
      }
      return previous(input, init);
    };
  }, png);
}

test('Stage 3 demo: lecture → visual lesson → fal media → practice misconception → saved restart', async () => {
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
    await page.getByRole('button', { name: 'Lecture walkthrough', exact: true }).click();
    await page.getByRole('button', { name: /Upload your lecture/ }).click();
    await page.getByRole('button', { name: 'Run me through the lecture', exact: true }).click();
    await expect(page.locator('.lecture-slide-image img')).toBeVisible();
    await expect
      .poll(async () => {
        const s = await page.evaluate(() => window.yoteach.getState());
        return s.ok && s.value.messages.some((m) => m.role === 'assistant');
      })
      .toBe(true);
    await provider.tool('save_explanation', { title: 'Why ATP is invested' });
    // 2. "Show me what happens": the interactive authored lesson.
    await provider.tool('open_visual_lesson', { lesson: 'glucose-phosphorylation', step: 3 });
    await expect(page.getByRole('slider', { name: 'Phosphate transfer' })).toBeVisible();
    // 3. A genuine fal request path (fixture queue), shown and saved with the step.
    const started = await provider.tool('generate_illustration', {
      subject: 'a small glowing orb handed from a battery to a hexagonal tile like a relay baton',
      kind: 'image',
    });
    expect(started.started).toBe(true);
    await expect(page.getByRole('img', { name: /AI-generated visual analogy/ })).toBeVisible();
    await expect
      .poll(() =>
        provider.messages.some(
          (m) => m.type === 'contextual_update' && String(m.text).includes('is now displayed'),
        ),
      )
      .toBe(true);
    // 4. Yoyo asks; the student answers incorrectly in their own words.
    const asked = await provider.tool('ask_practice_question', { question: 'why-invest' });
    expect(asked.modelAnswer).toBeUndefined();
    await expect(page.getByRole('heading', { name: /why does a cell “invest” ATP/ })).toBeVisible();
    await page.evaluate(() =>
      window.yoteach.tutor.intent({
        type: 'text',
        text: 'It gets the sugar ready, and glycolysis nets four ATP overall.',
      }),
    );
    await expect
      .poll(async () => {
        const s = await page.evaluate(() => window.yoteach.getState());
        return s.ok && s.value.messages.some((m) => m.text.includes('nets four ATP overall'));
      })
      .toBe(true);
    const recorded = await provider.tool('record_practice_attempt', {
      question: 'why-invest',
      answer: 'glycolysis nets four ATP overall',
    });
    expect(recorded.answerSource).toBe('transcript');
    expect(recorded.possibleMisconceptions[0].evidence).toBe('nets four ATP');
    const feedback = page.locator('.practice-feedback');
    await expect(feedback.getByText('Partly there')).toBeVisible();
    await expect(
      feedback.getByText('Possible misconception: Glycolysis nets four ATP per glucose.'),
    ).toBeVisible();
    await expect(feedback.getByText('From your answer: “nets four ATP”')).toBeVisible();
    // 5. The student also practises in the app: a deterministic option question.
    await page.getByRole('tab', { name: 'Question 1' }).click();
    await page.getByLabel('One ATP is produced as glucose is phosphorylated.').check();
    await page.getByRole('button', { name: 'Check answer', exact: true }).click();
    await expect(feedback.getByText('Not yet')).toBeVisible();
    await expect(page.locator('.practice-review li')).toHaveCount(2);
    await page
      .getByLabel('One ATP is consumed; its terminal phosphate is transferred to glucose.')
      .check();
    await page.getByRole('button', { name: 'Check new answer', exact: true }).click();
    await expect(feedback.getByText('Correct', { exact: true })).toBeVisible();
    await expect(page.locator('.practice-review li')).toHaveCount(1);
    expect(
      provider.messages.some(
        (m) => m.type === 'contextual_update' && String(m.text).includes('practice question'),
      ),
    ).toBe(true);
    await page.screenshot({ path: '.impeccable/review/practice-feedback.png' });
    await page
      .locator('.practice-review')
      .getByRole('button', { name: 'Review step 6', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Zoom out: investment and payoff' }),
    ).toBeVisible();
    // Playback time never creates practice evidence.
    const graded = await app.evaluate(() => (globalThis as any).gradeRequests.length);
    expect(graded).toBe(1);
    await page.getByRole('button', { name: 'Back to lecture', exact: true }).click();
    await page.getByRole('button', { name: 'End lecture', exact: true }).click();
    // 6. Restart: everything is still there.
    await app.close();
    app = undefined;
    boot = await launch(dir);
    app = boot.app;
    page = boot.page;
    await page.getByRole('button', { name: 'Saved material', exact: true }).click();
    const saved = page.getByRole('dialog');
    await expect(saved.getByRole('heading', { name: 'Why ATP is invested' })).toBeVisible();
    await expect(
      saved.getByRole('button', { name: /Why invest ATP in glucose.*Step 6/ }),
    ).toBeVisible();
    await expect(
      saved.getByRole('button', { name: /Visual analogy · Lesson step 3/ }),
    ).toBeVisible();
    await expect(saved.getByText('3 saved answers')).toBeVisible();
    await expect(
      saved.getByText('Possible misconception: Glycolysis nets four ATP per glucose.'),
    ).toBeVisible();
    await expect(saved.getByText('Suggested: lesson step 6')).toBeVisible();
    await page.screenshot({ path: '.impeccable/review/saved-after-restart.png' });
    await saved.getByRole('button', { name: 'Open practice', exact: true }).click();
    await expect(page.getByRole('heading', { name: /why does a cell “invest” ATP/ })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
