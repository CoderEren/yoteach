import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
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
    OPENAI_API_KEY: 'test-only-vision',
    VISION_API_KEY: '',
  } as Record<string, string>;
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.YOTEACH_DEV_URL;
  const app = await electron.launch({ args: ['.'], env });
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('#/'))).toBe(true);
  const page = app.windows().find((w) => w.url().endsWith('#/'))!;
  await expect(page.getByRole('heading', { name: 'Your space to understand.' })).toBeVisible();
  return { app, page };
}
async function shot(page: Page, name: string) {
  mkdirSync('.impeccable/review', { recursive: true });
  const toast = page.getByRole('button', { name: 'Dismiss notification', exact: true });
  if (await toast.isVisible()) await toast.click();
  await page.evaluate(async () => {
    const scroller = document.querySelector('.main-scroll');
    if (scroller) scroller.scrollTop = 0;
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((image) => image.decode().catch(() => {})));
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  await page.screenshot({
    path: resolve('.impeccable/review', name + '.png'),
    animations: 'disabled',
  });
}
test('real SDK with isolated provider fixtures: PDF grounding, six tools, follow-up, saved memory and stopping', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-sdk-'));
  let app: ElectronApplication | undefined;
  try {
    let boot = await launch(dir);
    app = boot.app;
    let page = boot.page;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Only this test process replaces transport. No production mock flags or live API calls.
    await app.evaluate(() => {
      globalThis.fetch = async (input, init) => {
        if (
          String(input).startsWith(
            'https://api.elevenlabs.io/v1/convai/conversation/get-signed-url',
          )
        )
          return new Response(
            JSON.stringify({
              signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?signature=test-only',
            }),
          );
        if (String(input) === 'https://api.openai.com/v1/responses') {
          const body = JSON.parse(String(init?.body));
          if (
            body.store !== false ||
            !body.input[0].content[1].image_url.startsWith('data:image/jpeg')
          )
            throw new Error('Invalid vision request');
          return new Response(
            JSON.stringify({
              status: 'completed',
              output: [
                {
                  content: [
                    {
                      type: 'output_text',
                      text: JSON.stringify({
                        explanation:
                          'The cell invests ATP to activate glucose before the payoff phase.',
                        regions: [
                          {
                            box: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
                            label: 'Energy investment',
                            evidence: 'Energy investment phase',
                            confidence: 0.98,
                            shape: 'highlight',
                          },
                        ],
                      }),
                    },
                  ],
                },
              ],
            }),
          );
        }
        throw new Error('Unexpected network request in test');
      };
    });
    let region: { snapshotId: string; regions: { regionId: string }[] } | undefined;
    let topicId = '';
    let event = 0;
    const calls: string[] = [];
    await page.routeWebSocket('wss://api.elevenlabs.io/**', (ws) => {
      const send = (data: unknown) => ws.send(JSON.stringify(data));
      const reply = (text: string) =>
        send({
          type: 'agent_response',
          agent_response_event: { agent_response: text, event_id: ++event },
        });
      ws.onMessage((raw) => {
        const message = JSON.parse(String(raw));
        if (message.type === 'conversation_initiation_client_data')
          send({
            type: 'conversation_initiation_metadata',
            conversation_initiation_metadata_event: {
              conversation_id: 'fixture-conversation',
              agent_output_audio_format: 'pcm_16000',
              user_input_audio_format: 'pcm_16000',
            },
          });
        if (message.type === 'user_message') {
          const text = message.text as string;
          if (text === 'Why invest ATP?')
            send({
              type: 'client_tool_call',
              client_tool_call: {
                tool_name: 'analyze_current_screen',
                tool_call_id: 'analyze',
                parameters: { question: text },
              },
            });
          else if (text === 'Circle the title')
            send({
              type: 'client_tool_call',
              client_tool_call: {
                tool_name: 'draw_annotation',
                tool_call_id: 'circle',
                parameters: {
                  snapshotId: region!.snapshotId,
                  regionId: region!.regions[0].regionId,
                  shape: 'circle',
                },
              },
            });
          else if (text === 'Highlight it')
            send({
              type: 'client_tool_call',
              client_tool_call: {
                tool_name: 'highlight_screen_region',
                tool_call_id: 'highlight',
                parameters: {
                  snapshotId: region!.snapshotId,
                  regionId: region!.regions[0].regionId,
                },
              },
            });
          else if (text === 'Save this explanation')
            send({
              type: 'client_tool_call',
              client_tool_call: {
                tool_name: 'save_explanation',
                tool_call_id: 'save',
                parameters: { title: 'ATP activates the substrate' },
              },
            });
          else if (text === 'Remember my question')
            send({
              type: 'client_tool_call',
              client_tool_call: {
                tool_name: 'record_learning_interaction',
                tool_call_id: 'record',
                parameters: { note: 'Asked why ATP is invested before the payoff phase.' },
              },
            });
          else if (text === 'Open this topic')
            send({
              type: 'client_tool_call',
              client_tool_call: {
                tool_name: 'open_topic',
                tool_call_id: 'open',
                parameters: { topicId },
              },
            });
          else reply('That investment prepares glucose for the reactions that follow.');
        }
        if (message.type === 'client_tool_result') {
          calls.push(message.tool_call_id);
          const result = JSON.parse(message.result);
          expect(result.error).toBeUndefined();
          if (message.tool_call_id === 'analyze') {
            region = result;
            reply(
              'ATP activates glucose before the payoff phase. The shared page marks the energy investment phase.',
            );
          }
          if (message.tool_call_id === 'circle') reply('I circled the title on the shared page.');
          if (message.tool_call_id === 'highlight')
            reply('The highlighted title identifies the investment phase.');
          if (message.tool_call_id === 'save') reply('Saved to this topic.');
          if (message.tool_call_id === 'record') reply('Your question is recorded.');
          if (message.tool_call_id === 'open') reply('Opened the topic in your workspace.');
        }
      });
    });
    await page.getByRole('button', { name: 'Explore a sample course' }).click();
    await page.getByRole('button', { name: 'Energy investment phase', exact: true }).click();
    const data = await page.evaluate(() => window.yoteach.getState());
    if (!data.ok) throw new Error(data.error);
    topicId = data.value.settings.lastTopicId!;
    await page.getByRole('button', { name: 'Study with Yoyo', exact: true }).first().click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Start with text', exact: true }).click();
    await expect(page.getByText('Connected · text ready', { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await page.getByRole('button', { name: 'Open source PDF', exact: true }).click();
    await expect(page.getByText('Loading page…', { exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: 'Share this page', exact: true }).click();
    await expect(page.locator('.shared-image img')).toBeVisible();
    async function ask(text: string) {
      await page.getByLabel('Ask Yoyo', { exact: true }).fill(text);
      await page.getByRole('button', { name: 'Send question', exact: true }).click();
    }
    await ask('Why invest ATP?');
    await expect(page.locator('.annotation-key')).toContainText('PDF text anchor');
    await expect(page.locator('.transcript-assistant').first()).toContainText(
      'ATP activates glucose',
    );
    const runtime = await page.evaluate(() => window.yoteach.tutor.get());
    if (!runtime.ok) throw new Error(runtime.error);
    const box = runtime.value.snapshot!.textBoxes.find((b) =>
      b.text.includes('Energy investment phase'),
    )!.box;
    expect(runtime.value.annotations[0].box).toEqual(box);
    await page.getByRole('button', { name: 'Save explanation', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Saved to topic', exact: true })).toBeVisible();
    await shot(page, 'study-connected');
    await page.evaluate(() => window.yoteach.command({ type: 'settings.update', theme: 'dark' }));
    await shot(page, 'study-connected-dark');
    await page.evaluate(() => window.yoteach.command({ type: 'settings.update', theme: 'light' }));
    const pet = app.windows().find((w) => w.url().includes('/companion'))!;
    await pet.getByRole('button', { name: 'Expand Yoyo panel', exact: true }).click();
    await shot(pet, 'companion-connected');
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('#/'))!
        .setSize(1000, 720),
    );
    await shot(page, 'study-connected-small');
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('#/'))!
        .setSize(1280, 850),
    );
    await ask('Circle the title');
    await expect(page.locator('.annotation-circle')).toBeVisible();
    await ask('Highlight it');
    await expect(page.locator('.annotation-highlight')).toBeVisible();
    await ask('Save this explanation');
    await expect.poll(() => calls.includes('save')).toBe(true);
    await ask('Remember my question');
    await expect(
      page.getByText('Asked why ATP is invested before the payoff phase.', { exact: true }),
    ).toBeVisible();
    await ask('Open this topic');
    await expect(
      page.getByRole('heading', { name: 'Energy investment phase', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Explanations', exact: true }).click();
    await expect(page.locator('.saved-explanations')).toContainText('ATP activates glucose');
    await shot(page, 'explanations-connected');
    await page.getByRole('button', { name: 'Study with Yoyo', exact: true }).first().click();
    await page.getByRole('button', { name: 'Stop sharing', exact: true }).click();
    await expect(page.locator('.shared-image')).not.toBeVisible();
    await ask('And then?');
    await expect(
      page.getByText('That investment prepares glucose for the reactions that follow.', {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByText('Session paused', { exact: true })).toBeVisible();
    const stopped = await page.evaluate(() => window.yoteach.tutor.get());
    if (!stopped.ok) throw new Error(stopped.error);
    expect(stopped.value.mic).toBe(false);
    expect(stopped.value.snapshot).toBeNull();
    expect(stopped.value.sessionId).toBeNull();
    expect(calls.sort()).toEqual(['analyze', 'circle', 'highlight', 'open', 'record', 'save']);
    expect(errors).toEqual([]);
    await app.close();
    app = undefined;
    boot = await launch(dir);
    app = boot.app;
    page = boot.page;
    await page.getByRole('button', { name: 'Study with Yoyo', exact: true }).first().click();
    await expect(page.locator('.session-history-row')).toHaveCount(1);
    await page.locator('.session-history-row>button').first().click();
    await expect(page.locator('.conversation-messages')).toContainText('ATP activates glucose');
    const saved = await page.evaluate(() => window.yoteach.getState());
    if (!saved.ok) throw new Error(saved.error);
    expect(saved.value.explanations.length).toBe(2);
    expect(saved.value.sessions[0].endedAt).not.toBeNull();
    await page.getByRole('button', { name: /Delete session from/ }).click();
    await page.getByRole('button', { name: 'Delete session', exact: true }).click();
    await expect(page.locator('.session-history-row')).toHaveCount(0);
  } finally {
    if (app) await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('voice SDK loads local worklets, reacts to interruption, and stops synthetic audio on pause', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-voice-'));
  let app: ElectronApplication | undefined;
  try {
    const boot = await launch(dir);
    app = boot.app;
    const page = boot.page;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await app.evaluate(({ systemPreferences }) => {
      systemPreferences.askForMediaAccess = async () => true;
      globalThis.fetch = async (input) => {
        if (String(input).startsWith('https://api.elevenlabs.io/'))
          return new Response(
            JSON.stringify({
              signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?signature=voice-test',
            }),
          );
        throw new Error('Unexpected live request');
      };
    });
    // Runs before app scripts: the normal controller still wraps and stops these streams.
    await page.addInitScript(() => {
      const streams: MediaStream[] = [];
      const contexts: AudioContext[] = [];
      (window as any).__testStreams = streams;
      (window as any).__testContexts = contexts;
      navigator.mediaDevices.getUserMedia = async () => {
        const context = new AudioContext();
        const target = context.createMediaStreamDestination();
        contexts.push(context);
        streams.push(target.stream);
        return target.stream;
      };
    });
    await page.reload();
    let socket: import('@playwright/test').WebSocketRoute | undefined;
    await page.routeWebSocket('wss://api.elevenlabs.io/**', (ws) => {
      socket = ws;
      ws.onMessage((raw) => {
        const data = JSON.parse(String(raw));
        if (data.type === 'conversation_initiation_client_data')
          ws.send(
            JSON.stringify({
              type: 'conversation_initiation_metadata',
              conversation_initiation_metadata_event: {
                conversation_id: 'voice-fixture',
                agent_output_audio_format: 'pcm_16000',
                user_input_audio_format: 'pcm_16000',
              },
            }),
          );
      });
    });
    await page.getByRole('button', { name: 'Explore a sample course' }).click();
    await page.getByRole('button', { name: 'Energy investment phase', exact: true }).click();
    await page.getByRole('button', { name: 'Study with Yoyo', exact: true }).first().click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Start voice session', exact: true }).click();
    await expect
      .poll(async () => {
        const r = await page.evaluate(() => window.yoteach.tutor.get());
        return r.ok && r.value.status === 'connected' && r.value.mic;
      })
      .toBe(true);
    expect(await page.evaluate(() => (window as any).__testStreams.length)).toBeGreaterThan(0);
    socket!.send(
      JSON.stringify({
        type: 'audio',
        audio_event: { audio_base_64: Buffer.alloc(32000).toString('base64'), event_id: 10 },
      }),
    );
    await expect(page.locator('.tutor-presence .yoyo--speaking')).toBeVisible();
    socket!.send(JSON.stringify({ type: 'interruption', interruption_event: { event_id: 11 } }));
    await expect(page.locator('.tutor-presence .yoyo--listening')).toBeVisible();
    await page.getByRole('button', { name: 'Mute', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Unmute', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByText('Session paused', { exact: true })).toBeVisible();
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
    if (app) await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
