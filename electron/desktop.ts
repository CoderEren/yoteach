import { app, BrowserWindow, systemPreferences, screen } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import type { Store } from './store';
import type { TutorRuntime, TutorIntent } from '../shared/tutor';
import { fitImage, pointBeside } from '../shared/desktop-geometry';

export function installDesktop(options: {
  store: Store;
  root: string;
  pet: () => BrowserWindow | null;
  main: () => BrowserWindow | null;
  overlay: () => BrowserWindow | null;
  intent: (action: TutorIntent) => void;
  keyError: (error: string) => void;
}) {
  const { store, pet, main, overlay } = options;
  let helper: ChildProcess | undefined,
    binding = '',
    dragging = false;
  let origin = { x: 0, y: 0 },
    pointer = { x: 0, y: 0 };
  let home = store.snapshot().settings.mascotPosition;
  let flight: ReturnType<typeof setInterval> | undefined;
  let returnTimer: ReturnType<typeof setTimeout> | undefined;
  let safetyTimer: ReturnType<typeof setTimeout> | undefined;
  let focusKey = '',
    pointed = false,
    disposed = false;
  function animate(x: number, y: number) {
    clearInterval(flight);
    const win = pet();
    if (!win || win.isDestroyed()) return;
    const from = win.getBounds(),
      start = Date.now();
    if (systemPreferences.getAnimationSettings().prefersReducedMotion) {
      win.setPosition(x, y);
      return;
    }
    flight = setInterval(() => {
      if (win.isDestroyed()) {
        clearInterval(flight);
        return;
      }
      const progress = Math.min(1, (Date.now() - start) / 550);
      const t = 1 - (1 - progress) ** 3;
      win.setPosition(Math.round(from.x + (x - from.x) * t), Math.round(from.y + (y - from.y) * t));
      if (progress === 1) clearInterval(flight);
    }, 16);
  }
  function returnHome() {
    clearTimeout(returnTimer);
    overlay()?.hide();
    pet()?.webContents.send('companion:pose', { direction: null });
    if (!dragging && pointed && home) {
      const area = screen.getDisplayNearestPoint(home).workArea;
      animate(
        Math.max(area.x, Math.min(home.x, area.x + area.width - 200)),
        Math.max(area.y, Math.min(home.y, area.y + area.height - 220)),
      );
    }
    pointed = false;
  }
  function keySettings() {
    const next = store.snapshot().settings.talkKey;
    if (binding === next || disposed) return;
    binding = next;
    helper?.kill();
    options.intent({ type: 'hold-cancel' });
    if (process.platform !== 'darwin') {
      options.keyError('Global hold keys require macOS. Hold Yoyo to speak.');
      return;
    }
    const processChild = spawn(join(options.root, 'hold-key'), [next], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    helper = processChild;
    let buffer = '';
    processChild.stdout?.on('data', (chunk) => {
      if (helper !== processChild || disposed) return;
      buffer += String(chunk);
      const lines = buffer.split('\n');
      buffer = lines.pop()!;
      for (const line of lines) {
        if (line === 'permission')
          options.keyError(
            'Enable Yoteach in System Settings → Privacy & Security → Input Monitoring to use the global talk key. Holding Yoyo works without it.',
          );
        if (line === 'ready') options.keyError('');
        if (line === 'down') {
          options.intent({ type: 'hold-start' });
          clearTimeout(safetyTimer);
          safetyTimer = setTimeout(() => options.intent({ type: 'hold-end' }), 60000);
        }
        if (line === 'up') {
          clearTimeout(safetyTimer);
          options.intent({ type: 'hold-end' });
        }
      }
    });
    processChild.on('error', () =>
      options.keyError(
        'The global talk key helper is unavailable. Rebuild the app; holding Yoyo still works.',
      ),
    );
    processChild.on('exit', () => {
      if (helper === processChild && !disposed) {
        options.intent({ type: 'hold-cancel' });
        options.keyError('Global talk key stopped. Restart Yoteach; holding Yoyo still works.');
      }
    });
  }
  function update(r: TutorRuntime) {
    keySettings();
    if (r.input === 'arming' || r.input === 'listening') {
      clearInterval(flight);
      clearTimeout(returnTimer);
      overlay()?.hide();
      pet()?.webContents.send('companion:pose', { direction: null });
      focusKey = '';
      return;
    }
    if (!r.sessionId || r.sharing === 'off' || (pointed && r.activity === 'idle')) {
      focusKey = '';
      returnHome();
      return;
    }
    const region = r.annotations.find((a) => a.id === r.focusRegion),
      snapshot = r.snapshot;
    if (!region || !snapshot || dragging || !store.snapshot().settings.mascotVisible) {
      returnHome();
      return;
    }
    const key = `${snapshot.id}:${r.focusRevision}`;
    if (key === focusKey) return;
    focusKey = key;
    let area: import('../shared/desktop-geometry').Rect;
    if (snapshot.source.kind === 'screen') {
      const source = snapshot.source;
      area = source.bounds;
      if (
        !screen
          .getAllDisplays()
          .some(
            (d) =>
              String(d.id) === source.id &&
              d.bounds.x === area.x &&
              d.bounds.y === area.y &&
              d.bounds.width === area.width &&
              d.bounds.height === area.height,
          )
      )
        return;
      const layer = overlay();
      layer?.setBounds(area);
      layer?.webContents.send('tutor:changed', r);
      layer?.showInactive();
    } else if (snapshot.source.kind === 'pdf' && main()?.isFullScreen()) {
      const bounds = main()!.getContentBounds();
      area = fitImage(snapshot, { ...bounds, height: bounds.height - 76 });
    } else return;
    const target = pointBeside(region.box, area);
    if (!pointed) home = store.snapshot().settings.mascotPosition ?? pet()?.getBounds() ?? null;
    pointed = true;
    pet()?.showInactive();
    pet()?.webContents.send('companion:pose', { direction: target.direction });
    animate(target.x, target.y);
    clearTimeout(returnTimer);
    returnTimer = setTimeout(returnHome, 9000);
  }
  function drag(action: { phase: 'start' | 'move' | 'end'; x: number; y: number }) {
    const win = pet();
    if (!win) return;
    if (action.phase === 'start') {
      dragging = true;
      clearInterval(flight);
      clearTimeout(returnTimer);
      overlay()?.hide();
      pet()?.webContents.send('companion:pose', { direction: null });
      pointed = false;
      const b = win.getBounds();
      origin = { x: b.x, y: b.y };
      pointer = action;
      options.intent({ type: 'hold-cancel' });
    }
    if (!dragging) return;
    const x = origin.x + action.x - pointer.x,
      y = origin.y + action.y - pointer.y;
    const area = screen.getDisplayNearestPoint({ x: action.x, y: action.y }).workArea;
    win.setPosition(
      Math.round(Math.max(area.x, Math.min(x, area.x + area.width - 200))),
      Math.round(Math.max(area.y, Math.min(y, area.y + area.height - 220))),
    );
    if (action.phase === 'end') {
      dragging = false;
      const b = win.getBounds();
      home = { x: b.x, y: b.y };
      store.settings({ mascotPosition: home });
    }
  }
  app.on('before-quit', () => {
    disposed = true;
    helper?.kill();
    clearInterval(flight);
    clearTimeout(returnTimer);
    clearTimeout(safetyTimer);
  });
  screen.on('display-metrics-changed', returnHome);
  screen.on('display-removed', returnHome);
  return { update, drag, returnHome, keySettings };
}
