import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
async function launch(dir: string) {
  const env = {
    ...process.env,
    YOTEACH_DATA_DIR: dir,
    ELEVENLABS_API_KEY: '',
    ELEVENLABS_AGENT_ID: '',
    ANTHROPIC_API_KEY: '',
  } as Record<string, string>;
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.YOTEACH_DEV_URL;
  const app = await electron.launch({ args: ['.'], env });
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('#/'))).toBe(true);
  const page = app.windows().find((w) => w.url().endsWith('#/'))!;
  await expect(page.getByRole('heading', { name: 'Let’s work through it.' })).toBeVisible();
  return { app, page };
}
test('two modes, PDF persistence, companion restore and all yo-yo states', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-desktop-'));
  let app: ElectronApplication | undefined;
  mkdirSync('.impeccable/review', { recursive: true });
  try {
    let boot = await launch(dir);
    app = boot.app;
    let page = boot.page;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await expect(page.locator('.primary-nav button')).toHaveCount(2);
    await expect(page.getByText('Study with Yoyo', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: '.impeccable/review/ai-tutor.png' });
    await page.getByRole('button', { name: 'Lecture walkthrough', exact: true }).click();
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    }, resolve('public/sample-lecture.pdf'));
    await page.getByRole('button', { name: 'Upload lecture PDF' }).click();
    await expect(page.getByLabel('Choose your lecture')).not.toHaveValue('');
    const state = await page.evaluate(() => window.yoteach.getState());
    expect(state.ok && state.value.topics.length).toBe(0);
    await page.getByRole('button', { name: 'Preview lecture slides' }).click();
    await expect(page.locator('canvas')).toBeVisible();
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page.getByLabel('Page number')).toHaveValue('2');
    await page.getByRole('button', { name: 'Extracted text', exact: true }).click();
    await expect(page.locator('.pdf-text')).toContainText('Glycolysis');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.screenshot({ path: '.impeccable/review/lecture-library.png' });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.screenshot({ path: '.impeccable/review/lecture-dark.png' });
    const pet = app.windows().find((w) => w.url().includes('/companion'))!;
    const before = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((w) => ({
        fullscreen: w.isFullScreenable(),
        url: w.webContents.getURL(),
        preferences: (w.webContents as any).getLastWebPreferences(),
      })),
    );
    expect(before.find((w) => w.url.includes('/companion'))?.fullscreen).toBe(false);
    for (const w of before) {
      expect(w.preferences.contextIsolation).toBe(true);
      expect(w.preferences.sandbox).toBe(true);
      expect(w.preferences.nodeIntegration).toBe(false);
    }
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('/companion'))!
        .setBounds({ x: 0, y: 0, width: 1512, height: 977 }),
    );
    await page.evaluate(() => window.yoteach.companion('hide'));
    await page.evaluate(() => window.yoteach.companion('show'));
    const bounds = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('/companion'))!
        .getBounds(),
    );
    expect([bounds.width, bounds.height]).toEqual([200, 220]);
    await pet.getByRole('button', { name: 'Expand Yoyo panel' }).click();
    await pet.getByText('Preview expressions', { exact: true }).click();
    for (const [label, state] of [
      ['Listening', 'listening'],
      ['Thinking', 'thinking'],
      ['Speaking', 'speaking'],
      ['Pointing', 'pointing'],
      ['Celebrating', 'success'],
      ['Unavailable', 'error'],
      ['Idle', 'idle'],
    ]) {
      await pet.getByRole('button', { name: label, exact: true }).click();
      await expect(pet.locator(`.yoyo--${state}`)).toBeVisible();
      await pet.screenshot({
        path: `.impeccable/review/yoyo-${state}.png`,
        animations: 'disabled',
      });
    }
    await pet.emulateMedia({ reducedMotion: 'reduce' });
    expect(
      await pet.locator('.yoyo-float').evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('none');
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('#/'))!
        .setSize(1000, 720),
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await pet.evaluate(() => window.yoteach.tutor.start(null, 'text'))).ok).toBe(false);
    expect((await page.evaluate(() => window.yoteach.readPdf('../../etc/passwd'))).ok).toBe(false);
    await app.close();
    app = undefined;
    boot = await launch(dir);
    app = boot.app;
    page = boot.page;
    await page.getByRole('button', { name: 'Saved material', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'sample-lecture.pdf', exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('packaged Yoteach starts with its own identity and isolated data', async () => {
  test.skip(
    !existsSync('release/Yoteach.app/Contents/MacOS/Yoteach'),
    'Run npm run package:mac to include the packaged launch check.',
  );
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-bundle-'));
  const env = {
    ...process.env,
    YOTEACH_DATA_DIR: dir,
    ELEVENLABS_API_KEY: '',
    ELEVENLABS_AGENT_ID: '',
    ANTHROPIC_API_KEY: '',
  } as Record<string, string>;
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.YOTEACH_DEV_URL;
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({
      executablePath: resolve('release/Yoteach.app/Contents/MacOS/Yoteach'),
      args: [],
      env,
    });
    await expect.poll(() => app!.windows().some((w) => w.url().endsWith('#/'))).toBe(true);
    const page = app.windows().find((w) => w.url().endsWith('#/'))!;
    await expect(page.getByRole('heading', { name: 'Let’s work through it.' })).toBeVisible();
    const info = await app.evaluate(({ app }) => ({
      packaged: app.isPackaged,
      name: app.getName(),
      data: app.getPath('userData'),
    }));
    expect(info).toEqual({ packaged: true, name: 'yoteach', data: dir });
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
