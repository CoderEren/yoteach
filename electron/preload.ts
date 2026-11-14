import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../shared/model';
const api: DesktopApi = {
  getState: () => ipcRenderer.invoke('workspace:get'),
  command: (command) => ipcRenderer.invoke('workspace:command', command),
  pickPdf: (courseId, sample = false) => ipcRenderer.invoke('pdf:pick', { courseId, sample }),
  finishImport: (payload) => ipcRenderer.invoke('pdf:finish', payload),
  cancelImport: (token) => ipcRenderer.invoke('pdf:cancel', token),
  readPdf: (id) => ipcRenderer.invoke('pdf:read', id),
  companion: (action) => ipcRenderer.invoke('companion:action', action),
  onState: (callback) => {
    const listener = (_event: unknown, state: Parameters<typeof callback>[0]) => callback(state);
    ipcRenderer.on('workspace:changed', listener);
    return () => ipcRenderer.removeListener('workspace:changed', listener);
  },
};
contextBridge.exposeInMainWorld('yoteach', api);
