import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const captures = resolve('.impeccable/review');
mkdirSync(captures, { recursive: true });
async function launch(directory: string) {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    YOTEACH_DATA_DIR: directory,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.YOTEACH_DEV_URL;
  const app = await electron.launch({ args: ['.'], env });
  await expect.poll(() => app.windows().some((w) => w.url().endsWith('#/'))).toBe(true);
  const page = app.windows().find((w) => w.url().endsWith('#/'))!;
  await expect(page.getByRole('heading', { name: 'Your space to understand.' })).toBeVisible();
  return { app, page };
}
async function shot(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  await page.screenshot({ path: join(captures, name + '.png'), animations: 'disabled' });
}
test('desktop journey: real PDF import, editing, native companion, security and restart persistence', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-e2e-'));
  let app: ElectronApplication | undefined;
  try {
    let launched = await launch(dir);
    app = launched.app;
    let page = launched.page;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await shot(page, 'empty-desktop');
    await page.getByRole('button', { name: 'Explore a sample course' }).click();
    await expect(
      page.getByRole('button', { name: 'Glycolysis: an overview', exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await shot(page, 'course-library');
    await page.getByRole('button', { name: 'Energy investment phase', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Energy investment phase', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Edit topic', exact: true }).click();
    await page
      .getByLabel('Your notes & overview')
      .fill('Why is ATP invested before it is produced?');
    await page.getByRole('button', { name: 'Save topic', exact: true }).click();
    await expect(
      page.getByText('Why is ATP invested before it is produced?', { exact: true }),
    ).toBeVisible();
    await shot(page, 'topic-desktop');
    await page
      .getByRole('button', { name: 'Open Sample · Introduction to metabolism.pdf', exact: true })
      .click();
    await expect(page.getByLabel('Page number')).toHaveValue('3');
    await expect(page.getByText('Loading page…', { exact: true })).not.toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    await shot(page, 'pdf-desktop');
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page.getByLabel('Page number')).toHaveValue('4');
    await page.getByRole('button', { name: 'Extracted text', exact: true }).click();
    await expect(page.locator('.pdf-text')).toContainText('Energy payoff phase');
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    // Native dialog is stubbed only in the test harness; the normal import/extraction path is unchanged.
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    }, resolve('public/sample-lecture.pdf'));
    await page.getByRole('button', { name: 'Add PDF', exact: true }).click();
    await expect(page.locator('.import-progress')).not.toBeVisible({ timeout: 30000 });
    await expect(
      page.getByText('2 documents · 10 topics · Local workspace', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Add topic', exact: true }).click();
    await page.getByLabel('Topic title').fill('Review questions');
    await page.getByLabel('Place under').selectOption({ label: 'Energy investment phase' });
    await page.getByRole('button', { name: 'Add topic', exact: true }).last().click();
    await expect(
      page.getByRole('heading', { name: 'Review questions', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete topic', exact: true }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Review questions', exact: true }),
    ).not.toBeVisible();
    await page.getByRole('button', { name: 'Rename course', exact: true }).click();
    await page.getByLabel('Course name').fill('Biochemistry');
    await page.getByRole('button', { name: 'Save name', exact: true }).click();
    await page
      .getByRole('button', { name: 'Energy investment phase', exact: true })
      .first()
      .click();
    await page.getByRole('button', { name: 'Settings', exact: false }).click();
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await shot(page, 'topic-dark');
    await page.getByRole('button', { name: 'yoteach home', exact: true }).click();
    await shot(page, 'dashboard-dark');
    await page.getByRole('button', { name: 'Settings', exact: false }).click();
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await shot(page, 'dashboard-desktop');
    const companion = app.windows().find((w) => w.url().includes('/companion'))!;
    await expect(companion.getByRole('button', { name: 'Expand Yoyo panel' })).toBeVisible();
    const winState = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((w) => ({
        url: w.webContents.getURL(),
        alwaysOnTop: w.isAlwaysOnTop(),
        bounds: w.getBounds(),
        preferences: (w.webContents as any).getLastWebPreferences(),
      })),
    );
    expect(winState.find((w) => w.url.includes('/companion'))?.alwaysOnTop).toBe(true);
    for (const w of winState) {
      expect(w.preferences.contextIsolation).toBe(true);
      expect(w.preferences.nodeIntegration).toBe(false);
      expect(w.preferences.sandbox).toBe(true);
    }
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes('/companion'))!
          .isFullScreenable(),
      ),
    ).toBe(false);
    // Reproduce the oversized transparent surface reported on restore.
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('/companion'))!
        .setBounds({ x: 0, y: 0, width: 1512, height: 977 }),
    );
    await page.evaluate(() => window.yoteach.companion('hide'));
    await page.evaluate(() => window.yoteach.companion('show'));
    const restored = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('/companion'))!
        .getBounds(),
    );
    expect({ width: restored.width, height: restored.height }).toEqual({ width: 200, height: 220 });
    await expect(companion.getByRole('button', { name: 'Expand Yoyo panel' })).toBeVisible();
    await companion.getByRole('button', { name: 'Expand Yoyo panel' }).click();
    await expect(companion.getByText('Animation preview', { exact: true })).toBeVisible();
    await expect(companion.getByText('Energy investment phase', { exact: true })).toBeVisible();
    for (const state of [
      'Listening',
      'Thinking',
      'Speaking',
      'Pointing',
      'Celebrating',
      'Unavailable',
      'Idle',
    ])
      await companion.getByRole('button', { name: state, exact: true }).click();
    await shot(companion, 'companion-expanded');
    await companion.getByRole('button', { name: 'Hide Yoyo', exact: true }).click();
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes('/companion'))
          ?.isVisible(),
      ),
    ).toBe(false);
    await page.getByRole('button', { name: 'Show Yoyo', exact: true }).first().click();
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes('/companion'))
          ?.isVisible(),
      ),
    ).toBe(true);
    await companion.getByRole('button', { name: 'Collapse Yoyo', exact: true }).click();
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes('/companion'),
      )!;
      w.setPosition(120, 120);
    });
    await expect
      .poll(() =>
        app!.evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()
              .find((w) => w.webContents.getURL().includes('/companion'))
              ?.getBounds().x,
        ),
      )
      .toBe(120);
    expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined');
    expect((await page.evaluate(() => window.yoteach.readPdf('../../etc/passwd'))).ok).toBe(false);
    expect(
      (
        await companion.evaluate(() =>
          window.yoteach.command({ type: 'course.create', title: 'Forbidden', color: 'iris' }),
        )
      ).ok,
    ).toBe(false);
    // Minimum supported desktop viewport.
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => !w.webContents.getURL().includes('/companion'))!
        .setSize(1000, 720),
    );
    await shot(page, 'dashboard-small');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await app.close();
    app = undefined;
    launched = await launch(dir);
    app = launched.app;
    page = launched.page;
    await expect(
      page.getByRole('button', { name: 'Continue learning', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continue learning', exact: true }).click();
    await expect(
      page.getByText('Why is ATP invested before it is produced?', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Biochemistry', exact: true })).toBeVisible();
    await page
      .getByRole('button', { name: 'Open Sample · Introduction to metabolism.pdf', exact: true })
      .click();
    await expect(page.getByLabel('Page number')).toHaveValue('3');
    await expect(page.getByText('Loading page…', { exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.getByRole('button', { name: 'Delete course', exact: true }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Start with something you’re learning.', exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
