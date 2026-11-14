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
