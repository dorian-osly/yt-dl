const { contextBridge, ipcRenderer } = require('electron');

function exposeListener(channel) {
  return (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };
}

const onDownloadProgress = exposeListener('download-progress');
const onDownloadComplete = exposeListener('download-complete');
const onDownloadFailed = exposeListener('download-failed');
const onDownloadErrorLog = exposeListener('download-error-log');
const onDownloadLog = exposeListener('download-log');
const onDownloadStarted = exposeListener('download-started');
const onSetupProgress = exposeListener('setup-progress');
const onSetupError = exposeListener('setup-error');

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  listThemes: () => ipcRenderer.invoke('list-themes'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  importConfig: () => ipcRenderer.invoke('import-config'),
  exportConfig: () => ipcRenderer.invoke('export-config'),
  resetConfig: () => ipcRenderer.invoke('reset-config'),

  startDownload: (opts) => ipcRenderer.invoke('start-download', opts),
  cancelDownload: () => ipcRenderer.invoke('cancel-download'),
  checkBinaries: () => ipcRenderer.invoke('check-binaries'),
  getVideoTitle: (url) => ipcRenderer.invoke('get-video-title', url),
  getVideoInfo: (url) => ipcRenderer.invoke('get-video-info', url),
  getYtdlpVersion: () => ipcRenderer.invoke('get-ytdlp-version'),
  updateBinaries: () => ipcRenderer.invoke('update-binaries'),

  onProgress: onDownloadProgress,
  onComplete: onDownloadComplete,
  onFailed: onDownloadFailed,
  onErrorLog: onDownloadErrorLog,
  onDownloadLog: onDownloadLog,
  onDownloadStarted: onDownloadStarted,
  onSetupProgress: onSetupProgress,
  onSetupComplete: (callback) => {
    ipcRenderer.on('setup-complete', () => callback());
  },
  onSetupError: onSetupError
});
