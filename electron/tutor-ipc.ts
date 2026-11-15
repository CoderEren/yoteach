import {
  app,
  BrowserWindow,
  desktopCapturer,
  nativeImage,
  powerMonitor,
  session,
  systemPreferences,
  screen,
} from 'electron';
import { z } from 'zod';
import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { Id } from '../shared/model';
import { IntentSchema, SnapshotSchema } from '../shared/tutor';
import { Providers } from './providers';
import { FalClient } from './fal';
import { TutorService } from './tutor';
import type { Store } from './store';
import { macStudyWindows } from './window-sources';
import { StuckWatch } from '../shared/stuck';
type Handle = (name: string, fn: (input: any) => unknown, workspaceOnly?: boolean) => void;
export function installTutor(
  store: Store,
  handle: Handle,
  main: () => BrowserWindow | null,
  pet: () => BrowserWindow | null,
  changed: () => void,
  open: () => void,
  root: string,
) {
  loadEnv({
    path: app.isPackaged ? join(app.getPath('userData'), '.env') : join(root, '.env'),
    quiet: true,
  });
  const providers = new Providers(
    {
      elevenKey: process.env.ELEVENLABS_API_KEY ?? '',
      agentId: process.env.ELEVENLABS_AGENT_ID ?? '',
      visionKey: process.env.ANTHROPIC_API_KEY ?? '',
      model: process.env.VISION_MODEL ?? 'claude-sonnet-5-5',
      quickModel: process.env.QUICK_VISION_MODEL || undefined,
    },
    undefined,
    (snapshot) => {
      // 39 × 39 patches fit the standard vision tier. Keep OCR geometry normalized.
      const image = nativeImage.createFromDataURL(snapshot.image);
      const scale = Math.min(1, 1092 / Math.max(snapshot.width, snapshot.height));
      const width = Math.max(1, Math.round(snapshot.width * scale));
      const height = Math.max(1, Math.round(snapshot.height * scale));
      return {
        ...snapshot,
        width,
        height,
        image:
          'data:image/jpeg;base64,' +
          image.resize({ width, height, quality: 'best' }).toJPEG(90).toString('base64'),
      };
    },
  );
  const emit = () => {
    changed();
    for (const w of [main(), pet()])
      if (w && !w.isDestroyed()) w.webContents.send('tutor:changed', service.get());
  };
  const fal = new FalClient({
    key: process.env.FAL_KEY ?? '',
    imageModel: process.env.FAL_IMAGE_MODEL || 'fal-ai/flux/schnell',
    videoModel: process.env.FAL_VIDEO_MODEL ?? '',
  });
  const service = new TutorService(store, providers, emit, open, fal);
  // A zoomed crop around what the student circled, with some surroundings for context.
  service.cropImage = (dataUrl, box) => {
    const img = nativeImage.createFromDataURL(dataUrl);
    const { width, height } = img.getSize();
    if (!width || !height) return null;
    const w = Math.min(1, Math.max(box.width * 1.6, 0.14)),
      h = Math.min(1, Math.max(box.height * 1.6, 0.14));
    const x = Math.min(1 - w, Math.max(0, box.x + box.width / 2 - w / 2)),
      y = Math.min(1 - h, Math.max(0, box.y + box.height / 2 - h / 2));
    const rect = {
      x: Math.round(x * width),
      y: Math.round(y * height),
      width: Math.max(1, Math.round(w * width)),
      height: Math.max(1, Math.round(h * height)),
    };
    let crop = img.crop(rect);
    if (rect.width > 1000) crop = crop.resize({ width: 1000, quality: 'good' });
    return {
      image: 'data:image/jpeg;base64,' + crop.toJPEG(85).toString('base64'),
      spot: {
        x: (box.x - x) / w,
        y: (box.y - y) / h,
        width: box.width / w,
        height: box.height / h,
      },
    };
  };
  let selected: { id: string; epoch: number } | null = null;
  let displayGrant = false;
  let holdActive = false;
  let captureAbort: AbortController | undefined;
  let captureDisplay: ReturnType<typeof screen.getPrimaryDisplay> | undefined;
  type Display = ReturnType<typeof screen.getPrimaryDisplay>;
  let earlyCapture: { display: Display; result: Promise<any> } | null = null;
  /** Screenshot plus on-device text recognition for one display. */
  function runCapture(display: Display, signal?: AbortSignal) {
    return promisify(execFile)(join(root, 'dist-electron/capture-screen'), [String(display.id)], {
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 16_000_000,
      signal,
    }).then(({ stdout }) => JSON.parse(stdout));
  }
  const privateName =
    /(incognito|inprivate|private browsing|private window|password|1password|bitwarden|keychain|safari|chrome|chromium|firefox|microsoft edge|brave|opera|arc browser)/i;
  async function sources() {
    // No preview images of unselected windows. Browsers are excluded because private tabs cannot be reliably identified.
    const list = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false,
    });
    const eligible = await macStudyWindows();
    const owned = [main()?.getMediaSourceId(), pet()?.getMediaSourceId()];
    return list.filter(
      (s) => eligible.has(s.id) && !owned.includes(s.id) && !privateName.test(s.name),
    );
  }
  async function validate(id: string, epoch: number) {
    if (
      !selected ||
      selected.id !== id ||
      selected.epoch !== epoch ||
      service.state.epoch !== epoch ||
      service.state.sharing !== 'window'
    )
      return false;
    const found = (await sources()).some((s) => s.id === id);
    if (!found) {
      stopSharing();
      main()?.webContents.send('tutor:intent', { type: 'stop-sharing' });
    }
    return found;
  }
  function stopSharing() {
    selected = null;
    displayGrant = false;
    service.stopSharing();
  }
  function stopSession() {
    selected = null;
    displayGrant = false;
    holdActive = false;
    captureAbort?.abort();
    service.end();
    const owner = main();
    if (owner && !owner.isDestroyed()) owner.webContents.send('tutor:intent', { type: 'end' });
  }
  session.defaultSession.setPermissionCheckHandler((wc, permission, _origin, details) => {
    if (wc !== main()?.webContents || (!service.state.sessionId && !holdActive)) return false;
    if (permission === 'media')
      return (
        (service.state.mode === 'voice' || holdActive) &&
        service.state.status !== 'paused' &&
        details.mediaType === 'audio'
      );
    return permission === 'display-capture' && displayGrant;
  });
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const allowed = wc === main()?.webContents && (!!service.state.sessionId || holdActive);
    callback(
      !!allowed &&
        ((permission === 'media' &&
          (service.state.mode === 'voice' || holdActive) &&
          'mediaTypes' in details &&
          details.mediaTypes?.every((t: string) => t === 'audio') === true) ||
          (permission === 'display-capture' && displayGrant)),
    );
  });
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      if (
        request.frame !== main()?.webContents.mainFrame ||
        !displayGrant ||
        !selected ||
        !request.videoRequested ||
        request.audioRequested
      ) {
        callback({});
        return;
      }
      displayGrant = false;
      const pick = selected,
        source = (await sources()).find((s) => s.id === pick.id);
      if (!source || service.state.epoch !== pick.epoch) {
        callback({});
        return;
      }
      callback({ video: source });
    } catch {
      callback({});
    }
  });
  handle('tutor:get', () => service.get());
  function intent(input: unknown) {
    const action = IntentSchema.parse(input);
    if (action.type === 'dismiss-error') {
      service.state.error = '';
      service.emit();
      return;
    }
    if (action.type === 'open') open();
    if (action.type === 'screen-clear') service.clearDrawing();
    if (action.type === 'hold-start') {
      stuck.reset();
      if (holdActive || service.state.input === 'sending') return;
      holdActive = true;
      captureDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      // Capture and read the screen the instant the key goes down, before the voice
      // connection is even ready; the session picks it up when it asks.
      earlyCapture = service.state.lecture
        ? null
        : { display: captureDisplay, result: runCapture(captureDisplay) };
      earlyCapture?.result.catch(() => {});
      service.state.input = 'arming';
      service.state.error = '';
      service.emit();
      if (app.isHidden()) app.show();
    }
    if (action.type === 'hold-end' || action.type === 'hold-cancel') {
      if (!holdActive && (action.type === 'hold-end' || service.state.input === 'idle')) return;
      holdActive = false;
      service.state.input = action.type === 'hold-end' ? 'sending' : 'idle';
      service.state.mic = false;
      if (action.type === 'hold-cancel') service.state.activity = 'idle';
      if (action.type === 'hold-cancel') {
        earlyCapture = null;
        if (action.reason) {
          service.state.notice =
            action.reason === 'silent'
              ? 'I didn’t hear anything. Hold and speak.'
              : 'Sorry, I lost that one. Please ask again.';
          setTimeout(() => {
            service.state.notice = null;
            service.emit();
          }, 2600);
        }
        captureAbort?.abort();
        if (!service.state.lecture) service.stopSharing(false);
      }
      service.emit();
    }
    if (action.type === 'stop-sharing') {
      captureAbort?.abort();
      stopSharing();
    }
    if (action.type === 'end' || action.type === 'pause') {
      holdActive = false;
      captureAbort?.abort();
      selected = null;
      displayGrant = false;
      service.end();
      main()?.setFullScreen(false);
      if (action.type === 'pause') {
        service.state.status = 'paused';
        service.emit();
      }
    }
    main()?.webContents.send('tutor:intent', action);
  }
  handle('tutor:intent', intent);
  handle('tutor:screen-map', () => service.screenMap(), true);
  handle('tutor:prepare-slide', (input) => service.prepareSlide(input), true);
  handle(
    'tutor:slide-briefing',
    (input) =>
      service.slideBriefing(
        z
          .number()
          .int()
          .min(0)
          .max(30000)
          .parse(input ?? 2500),
      ),
    true,
  );
  handle(
    'tutor:capture-screen',
    async () => {
      if (
        !service.state.sessionId ||
        !['arming', 'listening', 'sending'].includes(service.state.input)
      )
        throw new Error('Hold the talk key or Yoyo to capture your screen.');
      if (service.state.lecture) return;
      const id = service.state.sessionId,
        display = captureDisplay ?? screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      service.stopSharing();
      const epoch = service.state.epoch;
      captureAbort?.abort();
      const ctl = new AbortController();
      captureAbort = ctl;
      try {
        // Usually already done: the capture started when the key went down.
        const early = earlyCapture && earlyCapture.display.id === display.id ? earlyCapture : null;
        earlyCapture = null;
        const image = await (early ? early.result : runCapture(display, ctl.signal));
        if (ctl.signal.aborted || service.state.sessionId !== id || service.state.epoch !== epoch)
          return;
        const snapshot = SnapshotSchema.parse({
          ...image,
          id: randomUUID(),
          epoch,
          source: {
            kind: 'screen',
            id: String(display.id),
            name: 'Current screen',
            bounds: display.bounds,
          },
          capturedAt: new Date().toISOString(),
          textBoxes: image.textBoxes ?? [],
          words: image.words ?? [],
        });
        service.state.sharing = 'screen';
        service.state.sourceName = 'Current screen';
        service.acceptSnapshot(snapshot);
        service.preAnalyze();
      } catch (error) {
        if (ctl.signal.aborted || service.state.sessionId !== id) return;
        service.state.error =
          'Screen capture is unavailable. Enable Screen Recording for Yoteach in System Settings and restart. You can still ask a question without the screen.';
        service.emit();
        throw new Error(service.state.error);
      }
    },
    true,
  );
  handle(
    'tutor:start',
    async (input) => {
      const { topicId, mode, documentId, page } = z
        .object({
          topicId: Id.nullable(),
          mode: z.enum(['voice', 'text']),
          documentId: Id.optional(),
          page: z.number().int().min(1).max(500).optional(),
        })
        .parse(input);
      if (
        mode === 'voice' &&
        process.platform === 'darwin' &&
        !(await systemPreferences.askForMediaAccess('microphone'))
      )
        throw new Error(
          'Microphone access is off. Enable it for the app named in the macOS permission prompt, or use text.',
        );
      return service.start(topicId, mode, documentId, page);
    },
    true,
  );
  handle(
    'tutor:end',
    (input) => {
      const id = Id.parse(input);
      if (service.state.sessionId !== id) return;
      holdActive = false;
      captureAbort?.abort();
      service.end(id);
      selected = null;
      displayGrant = false;
    },
    true,
  );
  handle('tutor:update', (input) => service.update(input), true);
  handle(
    'tutor:transcript',
    (input) => {
      const p = z
        .object({
          sessionId: Id,
          role: z.enum(['user', 'assistant']),
          text: z.string().trim().min(1).max(16000),
          eventId: z.string().max(120),
        })
        .parse(input);
      service.transcript(p.sessionId, p.role, p.text, p.eventId);
    },
    true,
  );
  handle(
    'tutor:tool',
    (input) => {
      const p = z.object({ sessionId: Id, tool: z.unknown() }).parse(input);
      return service.tool(p.sessionId, p.tool as any);
    },
    true,
  );
  handle(
    'tutor:windows',
    async () => {
      if (!service.state.sessionId) throw new Error('Start a study session first.');
      try {
        return (await sources()).map((s) => ({ id: s.id, name: s.name.slice(0, 240) }));
      } catch {
        throw new Error(
          'Window access is unavailable. Enable Screen Recording for the app named by macOS (Yoteach, Electron or your terminal) and restart, or share an internal PDF page.',
        );
      }
    },
    true,
  );
  handle(
    'tutor:select-window',
    async (input) => {
      const id = z.string().max(200).parse(input),
        source = (await sources()).find((s) => s.id === id);
      if (!source)
        throw new Error(
          'This window is unavailable or excluded for privacy. Choose another study window.',
        );
      const epoch = service.selectWindow(id, source.name.slice(0, 240));
      selected = { id, epoch };
      displayGrant = true;
      return epoch;
    },
    true,
  );
  handle(
    'tutor:validate-window',
    (input) => {
      const p = z.object({ id: z.string().max(200), epoch: z.number().int() }).parse(input);
      return validate(p.id, p.epoch);
    },
    true,
  );
  handle(
    'tutor:snapshot',
    async (input) => {
      const s = SnapshotSchema.parse(input);
      if (s.source.kind !== 'window' || !(await validate(s.source.id, s.epoch)))
        throw new Error('Window sharing stopped. Choose the window again.');
      service.acceptSnapshot(s);
    },
    true,
  );
  handle(
    'tutor:share-pdf',
    (input) => {
      const snapshot = SnapshotSchema.parse(input);
      if (snapshot.source.kind !== 'pdf') throw new Error('Expected a lecture PDF page.');
      service.acceptSnapshot(snapshot, true);
      selected = null;
      displayGrant = false;
    },
    true,
  );
  handle('tutor:stop-sharing', () => {
    stopSharing();
    main()?.webContents.send('tutor:intent', { type: 'stop-sharing' });
  });
  handle('tutor:save', (input) => service.saveMessage(Id.parse(input)), true);
  handle(
    'tutor:delete-session',
    (input) => {
      const id = Id.parse(input);
      if (service.state.sessionId === id) stopSession();
      store.deleteSession(id);
      emit();
    },
    true,
  );
  handle(
    'tutor:delete-chat',
    (input) => {
      const id = Id.parse(input);
      if (service.state.chatId === id) service.state.chatId = null;
      store.deleteChat(id);
      emit();
    },
    true,
  );
  handle(
    'tutor:delete-explanation',
    (input) => {
      store.deleteExplanation(Id.parse(input));
      emit();
    },
    true,
  );
  handle('media:cancel', () => service.cancelGeneration(), true);
  handle('media:dismiss', () => service.dismissGeneration(), true);
  handle('media:read', (input) => store.readMedia(Id.parse(input)), true);
  handle(
    'media:remove',
    (input) => {
      store.deleteMedia(Id.parse(input));
      emit();
    },
    true,
  );
  // Proactive help: notice a long stay on one screen. Runs only on-device text recognition on
  // the display under the pointer; the image and text never leave this Mac.
  // Test hooks (never set in normal use): shorter tick and threshold, and ignoring idle time.
  const tickMs = Number(process.env.YOTEACH_STUCK_TICK_MS) || 30_000,
    fixedAfter = Number(process.env.YOTEACH_STUCK_AFTER_MS) || 0,
    ignoreIdle = process.env.YOTEACH_STUCK_IGNORE_IDLE === '1';
  // With any test hook set, each check says what it decided (main-process output only).
  const debug = !!(process.env.YOTEACH_STUCK_TICK_MS || process.env.YOTEACH_STUCK_AFTER_MS)
    ? (why: string) => console.log(`[stuck] ${new Date().toLocaleTimeString()} ${why}`)
    : () => {};
  const stuck = new StuckWatch(fixedAfter ? () => fixedAfter : undefined);
  const watch = setInterval(async () => {
    try {
      const s = store.snapshot().settings,
        r = service.state;
      // Pointing is only a moment after drawing, so it never counts as busy.
      const busy = holdActive
        ? 'holding the talk key'
        : r.lecture
          ? 'in a lecture'
          : r.input !== 'idle'
            ? `input ${r.input}`
            : ['listening', 'thinking', 'speaking'].includes(r.activity)
              ? `Yoyo is ${r.activity}`
              : main()?.isFocused()
                ? 'the Yoteach window is in front'
                : '';
      if (!s.proactiveHelp || !s.mascotVisible || busy) {
        debug(
          `skipped: ${!s.proactiveHelp ? 'turned off in Settings' : !s.mascotVisible ? 'Yoyo is hidden' : busy}`,
        );
        return stuck.reset();
      }
      // Staring at a hard slide without touching anything is exactly being stuck, so idle time
      // only counts as "away" after five minutes; and nobody is nudged after three idle minutes.
      const idle = ignoreIdle ? 0 : powerMonitor.getSystemIdleTime();
      if (idle > 300) {
        debug(`skipped: away (${Math.round(idle)} s without input)`);
        return stuck.reset();
      }
      const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const image = await runCapture(display);
      const words: string[] = (image.words ?? []).map((w: { text: string }) => w.text);
      const offer = stuck.observe(words, Date.now(), idle <= 180);
      debug(
        `${words.length} words · ${stuck.describe(Date.now())}${offer ? ' · OFFERING HELP' : ''}`,
      );
      if (!offer) return;
      const key = {
        control: 'Control',
        'right-control': 'Right Control',
        fn: 'Fn',
        'right-option': 'Right Option',
        f8: 'F8',
      }[s.talkKey];
      service.state.notice = `Stuck on this one? Hold ${key} and ask me.`;
      service.emit();
      setTimeout(() => {
        if (service.state.notice?.startsWith('Stuck')) {
          service.state.notice = null;
          service.emit();
        }
      }, 9000);
      // With a conversation already open, Yoyo offers help out loud too (no screen data sent).
      if (service.state.sessionId && service.state.status === 'connected')
        main()?.webContents.send('tutor:intent', { type: 'nudge' });
    } catch (e) {
      /* No Screen Recording permission or capture failed: stay quiet. */
      debug(`capture failed: ${e instanceof Error ? e.message.slice(0, 200) : e}`);
    }
  }, tickMs);
  watch.unref?.();
  app.on('before-quit', () => clearInterval(watch));
  powerMonitor.on('lock-screen', stopSession);
  powerMonitor.on('suspend', stopSession);
  return { service, stopSession, stopSharing, intent };
}
