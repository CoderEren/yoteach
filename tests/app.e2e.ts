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
  await expect(page.getByRole('button', { name: 'Chats', exact: true })).toBeVisible();
  return { app, page };
}
test('Chats and Lectures, minimal lecture setup, saved PDFs, draggable companion and restore', async () => {
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
    await page.getByRole('button', { name: 'Lectures', exact: true }).click();
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    }, resolve('public/sample-lecture.pdf'));
    await page.getByRole('button', { name: /Upload a lecture PDF/ }).click();
    await expect(page.locator('.lecture-upload')).toContainText('sample-lecture.pdf');
    await expect(page.locator('.lecture-new button')).toHaveCount(2);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByLabel('Ask Yoyo')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Why invest ATP/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);
    const state = await page.evaluate(() => window.yoteach.getState());
    expect(state.ok && state.value.topics.length).toBe(0);
    await page.getByRole('button', { name: 'Saved material', exact: true }).click();
    await page.getByRole('button', { name: 'sample-lecture.pdf', exact: true }).click();
    await expect(page.locator('canvas')).toBeVisible();
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page.getByLabel('Page number')).toHaveValue('2');
    await page.getByRole('button', { name: 'Extracted text', exact: true }).click();
    await expect(page.locator('.pdf-text')).toContainText('Glycolysis');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.screenshot({ path: '.impeccable/review/lecture-library.png' });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('radio', { name: 'Dark', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.screenshot({ path: '.impeccable/review/settings.png' });
    await page.getByLabel('Global talk key').selectOption('f8');
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
    await expect(pet.getByRole('button')).toHaveCount(1);
    await expect(pet.locator('.drag-grip, .yoyo-caption, .companion-panel')).toHaveCount(0);
    await pet.evaluate(async () => {
      await window.yoteach.drag({ phase: 'start', x: 100, y: 100 });
      await window.yoteach.drag({ phase: 'move', x: 300, y: 240 });
      await window.yoteach.drag({ phase: 'end', x: 300, y: 240 });
    });
    const position = await page.evaluate(() => window.yoteach.getState());
    expect(position.ok && position.value.settings.mascotPosition).toBeTruthy();
    await pet.screenshot({ path: '.impeccable/review/yoyo-idle.png', animations: 'disabled' });
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
    const restored = await page.evaluate(() => window.yoteach.getState());
    expect(restored.ok && restored.value.settings.talkKey).toBe('f8');
    expect(restored.ok && restored.value.settings.mascotPosition).toEqual(
      position.ok && position.value.settings.mascotPosition,
    );
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
    await expect(page.getByRole('button', { name: 'Chats', exact: true })).toBeVisible();
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
