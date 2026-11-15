// Opt-in live fal image and video check. Always isolated; no voice or screen access.
import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'yoteach-overnight-media-'));
const env = {
  ...process.env,
  YOTEACH_DATA_DIR: dir,
  ELEVENLABS_API_KEY: 'fixture-auth-only',
  ELEVENLABS_AGENT_ID: 'fixture-auth-only',
  ANTHROPIC_API_KEY: '',
  FAL_VIDEO_MODEL: 'fal-ai/ltx-2.3/text-to-video/fast',
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.YOTEACH_DEV_URL;
let app;
const results = [];
mkdirSync('docs/overnight/live', { recursive: true });
try {
  app = await electron.launch({ args: ['.'], env });
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('#/'))).toBe(true);
  let page = app.windows().find((w) => w.url().endsWith('#/'));
  await app.evaluate(() => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, ...args) =>
      String(input).includes('get-signed-url')
        ? new Response(
            JSON.stringify({
              signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?signature=fixture',
            }),
          )
        : original(input, ...args);
  });
  const started = await page.evaluate(() => window.yoteach.tutor.start(null, 'text'));
  if (!started.ok) throw new Error(started.error);
  const sessionId = started.value.id;

  for (const kind of ['image', 'video']) {
    const row = {
      kind,
      subject:
        kind === 'image'
          ? 'A Roman stone aqueduct crossing a green valley, clear daylight, no text'
          : 'A brass pendulum swinging slowly from left to right against a plain pale background, no text',
      phases: [],
    };
    appendFileSync(
      'docs/overnight/spend.md',
      `| ${new Date().toISOString()} | fal | 1 ${kind} attempt | Live Electron result and restart check |\n`,
    );
    const start = Date.now();
    const r = await page.evaluate(
      ({ sessionId, kind, subject }) =>
        window.yoteach.tutor.tool(sessionId, { name: 'generate_illustration', kind, subject }),
      { sessionId, kind, subject: row.subject },
    );
    if (!r.ok) throw new Error(r.error);
    let last;
    for (let i = 0; i < 600; i++) {
      const state = await page.evaluate(() => window.yoteach.tutor.get());
      const g = state.ok && state.value.generation;
      if (g && g.phase !== last) {
        row.phases.push({ phase: g.phase, atMs: Date.now() - start });
        last = g.phase;
      }
      if (g && ['done', 'failed', 'cancelled'].includes(g.phase)) {
        row.error = g.error || null;
        row.latencyMs = g.latencyMs;
        row.mediaId = g.mediaId;
        break;
      }
      await page.waitForTimeout(1000);
    }
    if (last === 'done') {
      const media = page.locator(
        kind === 'image' ? '.generated-media img' : '.generated-media video',
      );
      await expect(media).toBeVisible();
      if (kind === 'image') await media.evaluate((img) => img.decode());
      else {
        await media.evaluate(
          (v) =>
            new Promise((resolve) => {
              if (v.readyState >= 1) resolve();
              else v.addEventListener('loadedmetadata', resolve, { once: true });
            }),
        );
        await media.evaluate((v) => {
          v.currentTime = 2;
        });
        await page.waitForTimeout(800);
      }
      await page.screenshot({ path: `docs/overnight/live/${kind}.png` });
      row.label = await page.locator('.generated-media figcaption').innerText();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
    } else row.error ||= 'Generation did not complete before test deadline';
    results.push(row);
    writeFileSync('docs/overnight/live/media.json', JSON.stringify(results, null, 2));
  }
  await app.close();
  app = undefined;
  app = await electron.launch({ args: ['.'], env });
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('#/'))).toBe(true);
  const page2 = app.windows().find((w) => w.url().endsWith('#/'));
  await page2.getByRole('button', { name: 'Saved material', exact: true }).click();
  const state = await page2.evaluate(() => window.yoteach.getState());
  for (const row of results)
    row.persisted = state.ok && state.value.media.some((m) => m.id === row.mediaId);
  await page2.screenshot({ path: 'docs/overnight/live/media-restart.png' });
} catch (e) {
  results.push({ error: String(e) });
} finally {
  await app?.close();
  rmSync(dir, { recursive: true, force: true });
  writeFileSync('docs/overnight/live/media.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
}
