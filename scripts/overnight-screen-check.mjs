// Opt-in: approved public/sample-lecture.pdf only. Gate after launch lets the
// operator restore and inspect Preview before native capture sends to Anthropic.
import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const dir = mkdtempSync(join(tmpdir(), 'yoteach-approved-screen-'));
const gate = join(dir, 'ready');
const env = {
  ...process.env,
  YOTEACH_DATA_DIR: dir,
  ELEVENLABS_API_KEY: 'fixture-auth-only',
  ELEVENLABS_AGENT_ID: 'fixture-auth-only',
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.YOTEACH_DEV_URL;
let app;
const result = {
  source: 'public/sample-lecture.pdf in Preview',
  gate,
  realCapture: true,
  realVision: false,
};
try {
  app = await electron.launch({ args: ['.'], env });
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('#/'))).toBe(true);
  const page = app.windows().find((w) => w.url().endsWith('#/'));
  await app.evaluate(({ BrowserWindow }) => {
    const original = globalThis.fetch;
    globalThis.__approvedSample = false;
    globalThis.__screenUploadGate = new Promise((resolve) => {
      globalThis.__releaseScreenUpload = resolve;
    });
    globalThis.fetch = async (input, ...args) => {
      if (String(input).includes('get-signed-url'))
        return new Response(
          JSON.stringify({
            signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?signature=fixture',
          }),
        );
      if (String(input).includes('api.anthropic.com')) {
        await globalThis.__screenUploadGate;
        if (!globalThis.__approvedSample)
          throw new Error('Local sample-only validation rejected this screen; nothing uploaded.');
      }
      return original(input, ...args);
    };
    for (const w of BrowserWindow.getAllWindows())
      if (w.webContents.getURL().endsWith('#/')) w.hide();
  });
  const started = await page.evaluate(() => window.yoteach.tutor.start(null, 'text'));
  if (!started.ok) throw new Error(started.error);
  console.log(JSON.stringify({ readyGate: gate }));
  const deadline = Date.now() + 600000;
  while (!existsSync(gate)) {
    if (Date.now() > deadline) throw new Error('Screen approval gate timed out');
    await new Promise((r) => setTimeout(r, 300));
  }
  appendFileSync(
    'docs/overnight/spend.md',
    `| ${new Date().toISOString()} | Anthropic | 2 call attempts | Approved sample Preview inventory and analysis |\n`,
  );
  const armed = await page.evaluate(
    (sessionId) => window.yoteach.tutor.update({ sessionId, input: 'arming' }),
    started.value.id,
  );
  if (!armed.ok) throw new Error(armed.error);
  const capture = await page.evaluate(() => window.yoteach.tutor.captureScreen());
  if (!capture.ok) throw new Error(capture.error);
  const sampleOnly = await page.evaluate(async () => {
    const r = await window.yoteach.tutor.get();
    if (!r.ok) return false;
    const words = (r.value.snapshot?.words || [])
      .map((w) => w.text)
      .join(' ')
      .toLowerCase();
    return (
      words.includes('introduction to metabolism') &&
      words.includes('catabolic pathways') &&
      words.includes('sample material') &&
      !words.includes('codex')
    );
  });
  await app.evaluate((_, approved) => {
    globalThis.__approvedSample = approved;
    globalThis.__releaseScreenUpload();
  }, sampleOnly);
  if (!sampleOnly)
    throw new Error(
      'Local sample-only validation rejected the captured display; no Anthropic upload.',
    );
  result.realVision = true;
  const start = Date.now();
  result.analysis = await page.evaluate(
    (id) =>
      window.yoteach.tutor.tool(id, {
        name: 'analyze_current_screen',
        question: 'Explain metabolism on this sample lecture. Identify the title words precisely.',
      }),
    started.value.id,
  );
  result.analysisMs = Date.now() - start;
  result.mark = await page.evaluate(
    (id) =>
      window.yoteach.tutor.tool(id, {
        name: 'draw_on_screen',
        marks: [{ quote: 'Metabolism', shape: 'underline' }],
        clear: true,
      }),
    started.value.id,
  );
  result.grounding = await page.evaluate(async () => {
    const r = await window.yoteach.tutor.get();
    if (!r.ok) return r;
    return {
      width: r.value.snapshot?.width,
      height: r.value.snapshot?.height,
      words: r.value.snapshot?.words,
      annotations: r.value.annotations,
      drawing: r.value.drawing,
    };
  });
  await page.waitForTimeout(1800);
  execFileSync('/usr/sbin/screencapture', ['-x', 'docs/overnight/live/preview-desktop.png']);
  result.clear = await page.evaluate(
    (id) => window.yoteach.tutor.tool(id, { name: 'clear_screen' }),
    started.value.id,
  );
  const after = await page.evaluate(() => window.yoteach.tutor.get());
  result.cleared = after.ok && after.value.drawing === null;
} catch (e) {
  result.error = String(e);
} finally {
  await app?.close();
  rmSync(dir, { recursive: true, force: true });
  writeFileSync('docs/overnight/live/preview.json', JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      error: result.error,
      analysisMs: result.analysisMs,
      mark: result.mark,
      cleared: result.cleared,
    }),
  );
}
