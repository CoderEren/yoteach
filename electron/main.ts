import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  screen,
  session,
  Tray,
} from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Id, ImportSchema } from '../shared/model';
import { Store } from './store';
const here = dirname(fileURLToPath(import.meta.url));
const dev =
  process.env.YOTEACH_DEV_URL === 'http://127.0.0.1:5173' ? 'http://127.0.0.1:5173' : null;
if (process.env.YOTEACH_DATA_DIR) app.setPath('userData', resolve(process.env.YOTEACH_DATA_DIR));
app.setName('yoteach');
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'yoteach',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);
let workspace: BrowserWindow | null = null,
  companion: BrowserWindow | null = null,
  tray: Tray | null = null,
  store: Store,
  quitting = false,
  expanded = false;
let moveTimer: ReturnType<typeof setTimeout> | undefined;
const pending = new Map<
  string,
  { bytes: Uint8Array; name: string; courseId: string; created: number }
>();
const base = dev ?? 'yoteach://app';
function sendState() {
  const data = store.snapshot();
  for (const w of BrowserWindow.getAllWindows())
    if (!w.isDestroyed()) w.webContents.send('workspace:changed', data);
  updateTray();
  return data;
}
function secureWindow(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
}
function load(win: BrowserWindow, hash: string) {
  void win.loadURL(`${base}/index.html#${hash}`);
  secureWindow(win);
}
function showWorkspace() {
  if (workspace && !workspace.isDestroyed()) {
    workspace.show();
    workspace.focus();
  } else createWorkspace();
}
function createWorkspace() {
  workspace = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 980,
    minHeight: 680,
    title: 'yoteach',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    backgroundColor: '#F6F8FC',
    show: false,
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  load(workspace, '/');
  workspace.once('ready-to-show', () => workspace?.show());
  workspace.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      workspace?.hide();
    }
  });
  workspace.on('closed', () => {
    workspace = null;
  });
}
function clampPosition(x: number, y: number, width: number, height: number) {
  const area = screen.getDisplayNearestPoint({ x, y }).workArea;
  return {
    x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - height))),
  };
}
function savePosition() {
  if (!companion || companion.isDestroyed()) return;
  const b = companion.getBounds();
  const compact = { x: b.x + b.width - 200, y: b.y + b.height - 220 };
  store.settings({ mascotPosition: compact });
}
function resizeCompanion(open: boolean) {
  if (!companion) return;
  const b = companion.getBounds(),
    width = open ? 350 : 200,
    height = open ? 540 : 220;
  expanded = open;
  const p = clampPosition(b.x + b.width - width, b.y + b.height - height, width, height);
  companion.setBounds({ ...p, width, height });
  savePosition();
}
function showCompanion(show: boolean) {
  if (!companion) return;
  store.settings({ mascotVisible: show });
  if (show) companion.show();
  else companion.hide();
  sendState();
}
function createCompanion() {
  const area = screen.getPrimaryDisplay().workArea;
  const saved = store.snapshot().settings.mascotPosition;
  const position = clampPosition(
    saved?.x ?? area.x + area.width - 240,
    saved?.y ?? area.y + area.height - 260,
    200,
    220,
  );
  companion = new BrowserWindow({
    ...position,
    width: 200,
    height: 220,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  companion.setAlwaysOnTop(true, 'floating');
  companion.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  load(companion, '/companion');
  companion.once('ready-to-show', () => {
    if (store.snapshot().settings.mascotVisible) companion?.showInactive();
  });
  companion.on('moved', () => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(savePosition, 250);
  });
  companion.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      showCompanion(false);
    }
  });
}
function updateTray() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open learning workspace', click: showWorkspace },
      {
        label: store.snapshot().settings.mascotVisible ? 'Hide Yoyo' : 'Show Yoyo',
        click: () => showCompanion(!store.snapshot().settings.mascotVisible),
      },
      { type: 'separator' },
      { label: 'Quit yoteach', accelerator: 'CommandOrControl+Q', click: () => app.quit() },
    ]),
  );
}
function registerHandlers() {
  function handle(channel: string, fn: (input: any) => unknown, workspaceOnly = false) {
    ipcMain.handle(channel, async (event, input) => {
      try {
        const owner = BrowserWindow.fromWebContents(event.sender);
        const frame = event.senderFrame;
        if (
          !owner ||
          !frame ||
          frame !== event.sender.mainFrame ||
          ![workspace, companion].includes(owner) ||
          (workspaceOnly && owner !== workspace)
        )
          throw new Error('This action is not available in this window.');
        const url = new URL(frame.url);
        if (dev ? url.origin !== dev : url.protocol !== 'yoteach:' || url.host !== 'app')
          throw new Error('Untrusted application window.');
        return { ok: true, value: await fn(input) };
      } catch (e) {
        return {
          ok: false,
          error:
            e instanceof z.ZodError
              ? 'Invalid input. Check the values and try again.'
              : e instanceof Error
                ? e.message
                : 'Something went wrong. Please try again.',
        };
      }
    });
  }
  handle('workspace:get', () => store.snapshot());
  handle(
    'workspace:command',
    (input) => {
      store.command(input);
      return sendState();
    },
    true,
  );
  handle(
    'pdf:pick',
    async (input) => {
      const { courseId, sample } = z.object({ courseId: Id, sample: z.boolean() }).parse(input);
      if (!store.snapshot().courses.some((c) => c.id === courseId))
        throw new Error('Choose an existing course first.');
      for (const [key, value] of pending)
        if (Date.now() - value.created > 15 * 60 * 1000) pending.delete(key);
      if (pending.size >= 3)
        throw new Error('Finish the current PDF import before adding another.');
      let path: string;
      if (sample) {
        path = join(here, '../dist/sample-lecture.pdf');
        if (dev) path = join(here, '../public/sample-lecture.pdf');
      } else {
        const selected = await dialog.showOpenDialog(workspace!, {
          title: 'Add a lecture PDF',
          filters: [{ name: 'PDF documents', extensions: ['pdf'] }],
          properties: ['openFile'],
        });
        if (selected.canceled || !selected.filePaths[0]) return null;
        path = selected.filePaths[0];
      }
      const info = await stat(path);
      if (!info.isFile() || info.size > 50 * 1024 * 1024)
        throw new Error('Choose a PDF smaller than 50 MB.');
      const bytes = new Uint8Array(await readFile(path));
      if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-'))
        throw new Error('This file is not a readable PDF. Choose another file.');
      const token = randomUUID(),
        name = sample ? 'Sample · Introduction to metabolism.pdf' : basename(path);
      pending.set(token, { bytes, name, courseId, created: Date.now() });
      return { token, name, bytes: new Uint8Array(bytes) };
    },
    true,
  );
  handle(
    'pdf:finish',
    (input) => {
      const data = ImportSchema.parse(input);
      const source = pending.get(data.token);
      if (!source || source.courseId !== data.courseId)
        throw new Error('This import expired. Please select the PDF again.');
      store.importPdf(data, source.name, source.bytes);
      pending.delete(data.token);
      return sendState();
    },
    true,
  );
  handle(
    'pdf:cancel',
    (input) => {
      pending.delete(Id.parse(input));
    },
    true,
  );
  handle('pdf:read', (input) => store.readPdf(Id.parse(input)), true);
  handle('companion:action', (input) => {
    switch (z.enum(['show', 'hide', 'expand', 'collapse', 'workspace']).parse(input)) {
      case 'show':
        showCompanion(true);
        break;
      case 'hide':
        showCompanion(false);
        break;
      case 'expand':
        resizeCompanion(true);
        break;
      case 'collapse':
        resizeCompanion(false);
        break;
      case 'workspace':
        showWorkspace();
        break;
    }
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (store) showWorkspace();
  });
  void app.whenReady().then(() => {
    try {
      store = new Store(app.getPath('userData'));
    } catch (error) {
      dialog.showErrorBox('yoteach could not open your workspace', String(error));
      app.quit();
      return;
    }
    const root = resolve(here, '../dist');
    protocol.handle('yoteach', (request) => {
      try {
        const url = new URL(request.url);
        const path = resolve(root, '.' + decodeURIComponent(url.pathname));
        if (url.host !== 'app' || !path.startsWith(root + sep))
          return new Response('Not found', { status: 404 });
        return net.fetch(pathToFileURL(path).href);
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
      callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'" +
              (dev ? " 'unsafe-inline'" : '') +
              "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'" +
              (dev ? ' ws://127.0.0.1:5173' : '') +
              "; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",
          ],
          'X-Content-Type-Options': ['nosniff'],
        },
      }),
    );
    registerHandlers();
    createWorkspace();
    createCompanion();
    const image = nativeImage
      .createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAAeUlEQVR4nO3UwQ6AIAwDUP7/p/HiiQji2mVV22QnYLxkhNacD6afJdGnD1XdxyCD0kHj+u4+KFdNZpDVxazvYwqMoMoxqagoRmZUqSAUQ0WxMDTUK0B32J2zNAwKglAGRUFlD9sgg1BQBooSKYwkiIFKiwzkKcz5Rw7B58pEFeJqLAAAAABJRU5ErkJggg==',
      )
      .resize({ width: 18, height: 18 });
    image.setTemplateImage(true);
    tray = new Tray(image);
    tray.setToolTip('yoteach');
    updateTray();
    tray.on('double-click', showWorkspace);
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: 'yoteach',
          submenu: [
            {
              label: 'About yoteach',
              click: () =>
                dialog.showMessageBox({
                  type: 'info',
                  title: 'yoteach',
                  message: 'yoteach · Stage 1',
                  detail:
                    'Your local learning workspace and Yoyo companion. Voice and screen awareness are not connected.',
                }),
            },
            { type: 'separator' },
            {
              label: 'Show Yoyo',
              accelerator: 'CommandOrControl+Shift+Y',
              click: () => showCompanion(true),
            },
            { label: 'Open workspace', click: showWorkspace },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' },
      ]),
    );
    const registered = globalShortcut.register('CommandOrControl+Shift+Y', () =>
      showCompanion(!store.snapshot().settings.mascotVisible),
    );
    if (!registered)
      console.warn('Yoyo shortcut unavailable; use the menu bar or workspace control.');
    screen.on('display-removed', () => {
      if (companion) {
        const b = companion.getBounds();
        companion.setPosition(
          ...(Object.values(clampPosition(b.x, b.y, b.width, b.height)) as [number, number]),
        );
      }
    });
  });
  app.on('activate', () => {
    if (store) showWorkspace();
  });
  app.on('before-quit', () => {
    quitting = true;
    clearTimeout(moveTimer);
    if (store) savePosition();
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
