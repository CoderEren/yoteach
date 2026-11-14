import {
  app,
  BrowserWindow,
  desktopCapturer,
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
import { TutorService } from './tutor';
import type { Store } from './store';
import { macStudyWindows } from './window-sources';
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
  const providers = new Providers({
    elevenKey: process.env.ELEVENLABS_API_KEY ?? '',
    agentId: process.env.ELEVENLABS_AGENT_ID ?? '',
    visionKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.VISION_MODEL ?? 'claude-sonnet-4-6',
  });
  const emit = () => {
    changed();
    for (const w of [main(), pet()])
      if (w && !w.isDestroyed()) w.webContents.send('tutor:changed', service.get());
  };
  const service = new TutorService(store, providers, emit, (id) => {
    open();
    main()?.webContents.send('tutor:navigate', id);
  });
  let selected: { id: string; epoch: number } | null = null;
  let displayGrant = false;
  let holdActive = false;
  let captureAbort: AbortController | undefined;
  let captureDisplay: ReturnType<typeof screen.getPrimaryDisplay> | undefined;
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
    if (action.type === 'open') open();
    if (action.type === 'hold-start') {
      if (holdActive || service.state.input === 'sending') return;
      holdActive = true;
      captureDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
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
        const { stdout } = await promisify(execFile)(
          join(root, 'dist-electron/capture-screen'),
          [String(display.id)],
          { encoding: 'utf8', timeout: 15000, maxBuffer: 8_000_000, signal: ctl.signal },
        );
        if (ctl.signal.aborted || service.state.sessionId !== id || service.state.epoch !== epoch)
          return;
        const image = JSON.parse(stdout);
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
          textBoxes: [],
        });
        service.state.sharing = 'screen';
        service.state.sourceName = 'Current screen';
        service.acceptSnapshot(snapshot);
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
    'tutor:delete-explanation',
    (input) => {
      store.deleteExplanation(Id.parse(input));
      emit();
    },
    true,
  );
  powerMonitor.on('lock-screen', stopSession);
  powerMonitor.on('suspend', stopSession);
  return { service, stopSession, stopSharing, intent };
}
