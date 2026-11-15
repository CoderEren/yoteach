import { app, BrowserWindow, systemPreferences, screen } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import type { Store } from './store';
import type { TutorRuntime, TutorIntent } from '../shared/tutor';
import { PET, fitImage, pointBeside } from '../shared/desktop-geometry';
import type { TrailPoint } from '../shared/gesture';

export function installDesktop(options: {
  store: Store;
  root: string;
  pet: () => BrowserWindow | null;
  main: () => BrowserWindow | null;
  overlay: () => BrowserWindow | null;
  intent: (action: TutorIntent) => void;
  keyError: (error: string) => void;
  /** The cursor path drawn while the talk key was held (null when the hold was cancelled). */
  trail?: (trail: { startedAt: number; points: TrailPoint[]; aspect: number } | null) => void;
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
  let stage: Electron.Rectangle | null = null;
  let last: TutorRuntime | null = null;
  /**
   * Cursor ink: while the talk key is held the cursor leaves a fading trace on the overlay, so
   * the student can circle or point at what they are asking about.
   */
  let trailing: {
    bounds: Electron.Rectangle;
    startedAt: number;
    points: TrailPoint[];
    shown: boolean;
    moved: boolean;
    ticks: number;
    timer: ReturnType<typeof setInterval>;
  } | null = null;
  let trailShown: Electron.Rectangle | null = null,
    trailFade: ReturnType<typeof setTimeout> | undefined;
  function startTrail() {
    stopTrail();
    if (last?.lecture) return;
    const c0 = screen.getCursorScreenPoint();
    const bounds = screen.getDisplayNearestPoint(c0).bounds;
    const startedAt = Date.now();
    const t: NonNullable<typeof trailing> = {
      bounds,
      startedAt,
      points: [],
      shown: false,
      moved: false,
      ticks: 0,
      timer: setInterval(() => {
        const c = screen.getCursorScreenPoint();
        const p = {
          x: (c.x - bounds.x) / bounds.width,
          y: (c.y - bounds.y) / bounds.height,
          t: Date.now() - startedAt,
        };
        const prev = t.points.at(-1);
        t.points.push(p);
        if (t.points.length > 4000) t.points.shift();
        // Only show ink once the cursor really moves; a resting cursor draws nothing.
        if (!t.shown) {
          const first = t.points[0];
          if (Math.hypot(p.x - first.x, p.y - first.y) < 0.008) return;
          t.shown = true;
          clearTimeout(trailFade);
          trailShown = bounds;
          if (last) syncOverlay(last);
          else showStage(bounds);
          overlay()?.webContents.send('overlay:trail', { type: 'start', points: t.points });
          return;
        }
        if (!prev || prev.x !== p.x || prev.y !== p.y) {
          overlay()?.webContents.send('overlay:trail', { type: 'add', point: p });
          t.moved = true;
        }
        // Share the path as it grows, so a circled picture is understood before release.
        if (t.moved && ++t.ticks % 25 === 0) {
          t.moved = false;
          options.trail?.({
            startedAt,
            points: t.points.slice(),
            aspect: bounds.width / bounds.height,
          });
        }
      }, 16),
    };
    trailing = t;
  }
  /** Stop tracking; the trace fades out on screen. Returns the path for reading the gesture. */
  function stopTrail() {
    const t = trailing;
    if (!t) return null;
    clearInterval(t.timer);
    trailing = null;
    if (t.shown) {
      overlay()?.webContents.send('overlay:trail', { type: 'end' });
      clearTimeout(trailFade);
      trailFade = setTimeout(() => {
        trailShown = null;
        if (last) syncOverlay(last);
      }, 2400);
    }
    return {
      startedAt: t.startedAt,
      points: t.points,
      aspect: t.bounds.width / t.bounds.height,
    };
  }
  function showStage(want: Electron.Rectangle) {
    const layer = overlay();
    if (!layer || layer.isDestroyed()) return;
    if (
      !stage ||
      stage.x !== want.x ||
      stage.y !== want.y ||
      stage.width !== want.width ||
      stage.height !== want.height
    ) {
      stage = want;
      layer.setBounds(want);
    }
    if (!layer.isVisible()) layer.showInactive();
    // If macOS still moved the layer, the drawings shift back by the difference so they stay on
    // the words and pictures they mark.
    const got = layer.getBounds();
    layer.webContents.send('overlay:offset', { x: want.x - got.x, y: want.y - got.y });
  }
  let tour: ReturnType<typeof setTimeout>[] = [];
  const stopTour = () => {
    tour.forEach(clearTimeout);
    tour = [];
  };
  /** The overlay is Yoyo's drawing surface on the user's screen; lectures draw in the app. */
  function needsOverlay(r: TutorRuntime) {
    if (r.lecture) return false;
    const onScreen = r.snapshot?.source.kind === 'screen';
    const marks =
      onScreen &&
      !!(
        (r.focusRegion && r.focusSource === 'draw') ||
        r.drawing?.marks.length ||
        r.drawing?.connections.length
      );
    const media = !!r.generation && r.generation.origin === 'tutor';
    return marks || media || !!r.drawing?.diagram || !!r.drawing?.sketch;
  }
  function syncOverlay(r: TutorRuntime) {
    const layer = overlay();
    if (!layer || layer.isDestroyed()) return;
    layer.webContents.send('tutor:changed', r);
    if (!needsOverlay(r) && !trailShown) {
      stage = null;
      if (layer.isVisible()) {
        layer.setIgnoreMouseEvents(true, { forward: true });
        layer.hide();
      }
      return;
    }
    const source = r.snapshot?.source;
    // Grounded drawings must cover the captured display exactly; otherwise stay where we are.
    // While the cursor is inking, cover the display it is on.
    const want = trailShown
      ? trailShown
      : source?.kind === 'screen' &&
          screen
            .getAllDisplays()
            .some(
              (d) =>
                String(d.id) === source.id &&
                d.bounds.x === source.bounds.x &&
                d.bounds.y === source.bounds.y &&
                d.bounds.width === source.bounds.width &&
                d.bounds.height === source.bounds.height,
            )
        ? source.bounds
        : (stage ?? screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).bounds);
    showStage(want);
  }
  /** Yoyo heads home a moment after it stops talking, not between two sentences. */
  let restTimer: ReturnType<typeof setTimeout> | undefined;
  function returnHome() {
    clearTimeout(returnTimer);
    clearTimeout(restTimer);
    restTimer = undefined;
    stopTour();
    pet()?.webContents.send('companion:pose', { direction: null });
    if (!dragging && pointed && home) {
      const area = screen.getDisplayNearestPoint(home).workArea;
      animate(
        Math.max(area.x, Math.min(home.x, area.x + area.width - PET.width)),
        Math.max(area.y, Math.min(home.y, area.y + area.height - PET.height)),
      );
    }
    pointed = false;
  }
  function keySettings() {
    const next = store.snapshot().settings.talkKey;
    if (binding === next || disposed) return;
    binding = next;
    helper?.kill();
    stopTrail();
    options.trail?.(null);
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
          startTrail();
          clearTimeout(safetyTimer);
          safetyTimer = setTimeout(() => {
            options.trail?.(stopTrail());
            options.intent({ type: 'hold-end' });
          }, 60000);
        }
        if (line === 'up') {
          clearTimeout(safetyTimer);
          // The path goes first, so it is there when the screen map is asked for.
          options.trail?.(stopTrail());
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
        stopTrail();
        options.trail?.(null);
        options.intent({ type: 'hold-cancel' });
        options.keyError('Global talk key stopped. Restart Yoteach; holding Yoyo still works.');
      }
    });
  }
  function update(r: TutorRuntime) {
    last = r;
    keySettings();
    syncOverlay(r);
    if (r.input === 'arming' || r.input === 'listening') {
      clearInterval(flight);
      clearTimeout(returnTimer);
      stopTour();
      pet()?.webContents.send('companion:pose', { direction: null });
      focusKey = '';
      return;
    }
    if (!r.sessionId || r.sharing === 'off') {
      focusKey = '';
      returnHome();
      return;
    }
    const resting = !r.speaking && ['idle', 'error'].includes(r.activity);
    if (!resting) {
      clearTimeout(restTimer);
      restTimer = undefined;
    } else if (pointed && !restTimer)
      restTimer = setTimeout(() => {
        restTimer = undefined;
        focusKey = '';
        returnHome();
      }, 3000);
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
    // Yoyo follows what it says (each named part moves it on), so there is no timed tour.
    // It stays while it keeps talking about this part, and heads home once it goes quiet.
    stopTour();
    clearTimeout(returnTimer);
    returnTimer = setTimeout(() => {
      if (last?.speaking) return; // still explaining here; the rest timer takes it home later
      focusKey = '';
      returnHome();
    }, 15000);
  }
  function drag(action: { phase: 'start' | 'move' | 'end'; x: number; y: number }) {
    const win = pet();
    if (!win) return;
    if (action.phase === 'start') {
      dragging = true;
      clearInterval(flight);
      clearTimeout(returnTimer);
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
      Math.round(Math.max(area.x, Math.min(x, area.x + area.width - PET.width))),
      Math.round(Math.max(area.y, Math.min(y, area.y + area.height - PET.height))),
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
    stopTrail();
    helper?.kill();
    clearInterval(flight);
    clearTimeout(returnTimer);
    clearTimeout(safetyTimer);
  });
  screen.on('display-metrics-changed', returnHome);
  screen.on('display-removed', returnHome);
  /** Fly beside something Yoyo just put on screen (a sketch or a card), then come home. */
  function pointAt(box: { x: number; y: number; width: number; height: number }) {
    const layer = overlay();
    if (!layer || dragging || !store.snapshot().settings.mascotVisible) return;
    const area = layer.getBounds();
    const target = pointBeside(box, area);
    if (!pointed) home = store.snapshot().settings.mascotPosition ?? pet()?.getBounds() ?? null;
    pointed = true;
    stopTour();
    pet()?.showInactive();
    pet()?.webContents.send('companion:pose', { direction: target.direction });
    animate(target.x, target.y);
    clearTimeout(returnTimer);
    returnTimer = setTimeout(returnHome, 8000);
  }
  return { update, drag, returnHome, keySettings, pointAt };
}
