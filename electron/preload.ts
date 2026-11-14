import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../shared/model';
function listen<T>(channel: string, fn: (value: T) => void) {
  const listener = (_event: unknown, value: T) => fn(value);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}
const api: DesktopApi = {
  overlay: { interactive: (on) => ipcRenderer.invoke('overlay:interactive', on) },
  tutor: {
    get: () => ipcRenderer.invoke('tutor:get'),
    intent: (action) => ipcRenderer.invoke('tutor:intent', action),
    start: (topicId, mode, documentId, page) =>
      ipcRenderer.invoke('tutor:start', { topicId, mode, documentId, page }),
    end: (id) => ipcRenderer.invoke('tutor:end', id),
    update: (patch) => ipcRenderer.invoke('tutor:update', patch),
    transcript: (sessionId, role, text, eventId) =>
      ipcRenderer.invoke('tutor:transcript', { sessionId, role, text, eventId }),
    tool: (sessionId, tool) => ipcRenderer.invoke('tutor:tool', { sessionId, tool }),
    captureScreen: () => ipcRenderer.invoke('tutor:capture-screen'),
    windows: () => ipcRenderer.invoke('tutor:windows'),
    selectWindow: (id) => ipcRenderer.invoke('tutor:select-window', id),
    validateWindow: (id, epoch) => ipcRenderer.invoke('tutor:validate-window', { id, epoch }),
    sharePdf: (snapshot) => ipcRenderer.invoke('tutor:share-pdf', snapshot),
    snapshot: (snapshot) => ipcRenderer.invoke('tutor:snapshot', snapshot),
    stopSharing: () => ipcRenderer.invoke('tutor:stop-sharing'),
    save: (id) => ipcRenderer.invoke('tutor:save', id),
    deleteSession: (id) => ipcRenderer.invoke('tutor:delete-session', id),
    deleteExplanation: (id) => ipcRenderer.invoke('tutor:delete-explanation', id),
    onChange: (fn) => listen('tutor:changed', fn),
    onIntent: (fn) => {
      const off = listen('tutor:intent', fn);
      const stream = () => fn({ type: 'stop-sharing' });
      ipcRenderer.on('tutor:stop-stream', stream);
      return () => {
        off();
        ipcRenderer.removeListener('tutor:stop-stream', stream);
      };
    },
    onNavigate: (fn) => listen('tutor:navigate', fn),
  },
  media: {
    generate: (request) => ipcRenderer.invoke('media:generate', request),
    cancel: () => ipcRenderer.invoke('media:cancel'),
    dismiss: () => ipcRenderer.invoke('media:dismiss'),
    read: (id) => ipcRenderer.invoke('media:read', id),
    remove: (id) => ipcRenderer.invoke('media:remove', id),
  },
  practice: {
    answer: (questionId, answer) => ipcRenderer.invoke('practice:answer', { questionId, answer }),
    remove: (id) => ipcRenderer.invoke('practice:remove', id),
  },
  getState: () => ipcRenderer.invoke('workspace:get'),
  command: (command) => ipcRenderer.invoke('workspace:command', command),
  pickPdf: (courseId, sample = false) => ipcRenderer.invoke('pdf:pick', { courseId, sample }),
  finishImport: (payload) => ipcRenderer.invoke('pdf:finish', payload),
  cancelImport: (token) => ipcRenderer.invoke('pdf:cancel', token),
  readPdf: (id) => ipcRenderer.invoke('pdf:read', id),
  companion: (action) => ipcRenderer.invoke('companion:action', action),
  drag: (action) => ipcRenderer.invoke('companion:drag', action),
  lectureFullScreen: (show) => ipcRenderer.invoke('lecture:fullscreen', show),
  onPose: (fn) => listen('companion:pose', fn),
  onState: (callback) => {
    const listener = (_event: unknown, state: Parameters<typeof callback>[0]) => callback(state);
    ipcRenderer.on('workspace:changed', listener);
    return () => ipcRenderer.removeListener('workspace:changed', listener);
  },
};
contextBridge.exposeInMainWorld('yoteach', api);
