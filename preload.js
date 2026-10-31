const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('native', {
  openFiles: o => ipcRenderer.invoke('open-files', o),
  readFile: p => ipcRenderer.invoke('read-file', p),
  writeFile: o => ipcRenderer.invoke('write-file', o),
  saveFile: o => ipcRenderer.invoke('save-file', o),
  saveMany: o => ipcRenderer.invoke('save-many', o),
  quit: () => ipcRenderer.invoke('quit'),
  reveal: p => ipcRenderer.invoke('reveal', p),
  recWrite: l => ipcRenderer.invoke('rec-write', l),
  recList: () => ipcRenderer.invoke('rec-list'),
  recClear: () => ipcRenderer.invoke('rec-clear'),
  pickFolder: t => ipcRenderer.invoke('pick-folder', t),
  mtime: p => ipcRenderer.invoke('mtime', p),
  setProgress: frac => ipcRenderer.invoke('set-progress', frac),
  setBusyLock: active => ipcRenderer.invoke('set-busy-lock', active),
  openUrl: u => ipcRenderer.invoke('open-url', u),
  getPathForFile: f => {
    try {
      return (webUtils && typeof webUtils.getPathForFile === 'function') ? webUtils.getPathForFile(f) : ((f && f.path) || '');
    } catch (e) {
      return (f && f.path) || '';
    }
  }
});
