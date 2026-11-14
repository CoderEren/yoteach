import { BrowserWindow, desktopCapturer, powerMonitor, session, systemPreferences } from 'electron';
import { z } from 'zod';
import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';
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
  loadEnv({ path: join(root, '.env'), quiet: true });
  const providers = new Providers({
    elevenKey: process.env.ELEVENLABS_API_KEY ?? '',
    agentId: process.env.ELEVENLABS_AGENT_ID ?? '',
    visionKey: process.env.OPENAI_API_KEY ?? process.env.VISION_API_KEY ?? '',
    model: process.env.VISION_MODEL ?? 'gpt-4.1-mini',
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
    service.end();
    const owner = main();
    if (owner && !owner.isDestroyed()) owner.webContents.send('tutor:intent', { type: 'end' });
  }
  session.defaultSession.setPermissionCheckHandler((wc, permission, _origin, details) => {
    if (wc !== main()?.webContents || !service.state.sessionId) return false;
    if (permission === 'media')
      return (
        service.state.mode === 'voice' &&
        service.state.status !== 'paused' &&
        details.mediaType === 'audio'
      );
    return permission === 'display-capture' && displayGrant;
  });
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const allowed = wc === main()?.webContents && !!service.state.sessionId;
    callback(
      !!allowed &&
        ((permission === 'media' &&
          service.state.mode === 'voice' &&
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
  handle('tutor:intent', (input) => {
    const action = IntentSchema.parse(input);
    if (action.type === 'open') {
      open();
      main()?.webContents.send('tutor:intent', action);
      return;
    }
    if (action.type === 'stop-sharing') stopSharing();
    if (action.type === 'end' || action.type === 'pause') {
      selected = null;
      displayGrant = false;
      service.end();
      if (action.type === 'pause') {
        service.state.status = 'paused';
        service.emit();
      }
    }
    main()?.webContents.send('tutor:intent', action);
  });
  handle(
    'tutor:start',
    async (input) => {
      const { topicId, mode } = z
        .object({ topicId: Id, mode: z.enum(['voice', 'text']) })
        .parse(input);
      if (
        mode === 'voice' &&
        process.platform === 'darwin' &&
        !(await systemPreferences.askForMediaAccess('microphone'))
      )
        throw new Error(
          'Microphone access is off. Enable it for Electron in macOS Privacy & Security, or use text.',
        );
      return service.start(topicId, mode);
    },
    true,
  );
  handle(
    'tutor:end',
    (input) => {
      const id = Id.parse(input);
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
          'Window access is unavailable. Enable Screen Recording for Electron in macOS Privacy & Security and restart, or share an internal PDF page.',
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
      service.acceptSnapshot(input, true);
      selected = null;
      displayGrant = false;
      main()?.webContents.send('tutor:stop-stream');
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
  return { service, stopSession, stopSharing };
}
