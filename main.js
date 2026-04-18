const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { spawn } = require('child_process');

const paths = require('./src/main/paths');
const { loadSettings, saveSettings, defaultSettings, loadHistory, appendHistory, clearHistory } = require('./src/main/settings');
const { listThemes } = require('./src/main/themes');
const { ensureBinaries, deleteBinaries } = require('./src/main/binaries');
const {
  isValidYouTubeUrl, getExitReason, buildDownloadArgs,
  removeDownloadArtifacts, stopDownloadProcess, parseDownloadLine,
  getVideoTitle, getVideoInfo, getYtdlpVersion
} = require('./src/main/download');

let mainWindow;

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function shouldDisableGpu(settings) {
  return settings.disableGpu === true;
}

function applyGpuFlags(disable) {
  if (!disable) return;

  app.disableHardwareAcceleration();
  [
    'no-sandbox',
    'disable-gpu',
    'disable-software-rasterizer',
    'disable-gpu-compositing',
    'disable-gpu-rasterization',
    'disable-angle'
  ].forEach((flag) => app.commandLine.appendSwitch(flag));
  app.commandLine.appendSwitch('log-level', '3');
}

async function initApp() {
  const settings = await loadSettings();
  applyGpuFlags(shouldDisableGpu(settings));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    backgroundColor: '#1a1a2e'
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      loadSettings().then((settings) => {
        if (settings.devTools) {
          mainWindow.webContents.toggleDevTools();
          event.preventDefault();
        }
      });
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    ensureBinaries(mainWindow).catch((err) => {
      mainWindow.webContents.send('setup-error', err.message);
    });
  });
}

app.whenReady().then(async () => {
  await initApp();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('list-themes', () => listThemes());
ipcMain.handle('get-history', () => loadHistory());
ipcMain.handle('clear-history', () => clearHistory());

ipcMain.handle('save-settings', async (_e, settings) => {
  const current = await loadSettings();
  const merged = { ...current, ...settings };
  await saveSettings(merged);

  if ('disableGpu' in settings) {
    const oldVal = current.disableGpu;
    const newVal = settings.disableGpu;
    if (oldVal !== newVal) {
      sendToRenderer('gpu-restart-needed');
    }
  }

  return merged;
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('import-config', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const data = await fsp.readFile(result.filePaths[0], 'utf-8');
      const imported = JSON.parse(data);
      const merged = { ...await loadSettings(), ...imported };
      await saveSettings(merged);
      return merged;
    } catch (e) {
      console.error('Import error:', e);
      return null;
    }
  }
  return null;
});

ipcMain.handle('export-config', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'ytdl-config.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (!result.canceled && result.filePath) {
    try {
      const current = await loadSettings();
      await fsp.writeFile(result.filePath, JSON.stringify(current, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error('Export error:', e);
      return false;
    }
  }
  return false;
});

ipcMain.handle('reset-config', async () => {
  await saveSettings(defaultSettings);
  return defaultSettings;
});

ipcMain.handle('open-folder', (_e, folderPath) => {
  shell.openPath(folderPath);
});

ipcMain.handle('check-binaries', async () => {
  try {
    await fsp.access(paths.getYtDlpPath());
    await fsp.access(paths.getFfmpegPath());
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('get-video-title', async (_e, url) => {
  if (!isValidYouTubeUrl(url)) return url;
  return getVideoTitle(url);
});

ipcMain.handle('get-video-info', async (_e, url) => {
  if (!isValidYouTubeUrl(url)) return null;
  return getVideoInfo(url);
});

ipcMain.handle('get-ytdlp-version', () => getYtdlpVersion());

ipcMain.handle('update-binaries', async () => {
  try {
    await deleteBinaries();
    await ensureBinaries(mainWindow);
    return true;
  } catch {
    return false;
  }
});

let currentProcess = null;

ipcMain.handle('start-download', async (_e, { url, mode, isPlaylist, playlistTitle, perVideoSettings, verboseMode }) => {
  if (currentProcess) {
    return { success: false, error: 'Un téléchargement est déjà en cours.' };
  }

  if (!isValidYouTubeUrl(url)) {
    return { success: false, error: 'URL YouTube invalide.' };
  }

  const settings = await loadSettings();
  const mergedSettings = perVideoSettings ? { ...settings, ...Object.fromEntries(Object.entries(perVideoSettings).filter(([, v]) => v !== '')) } : settings;
  const { args, outputDir } = buildDownloadArgs(url, mode, mergedSettings, isPlaylist, playlistTitle);
  if (verboseMode) args.splice(0, 0, '-v');

  const ytDlpPath = paths.getYtDlpPath();
  const commandLine = [ytDlpPath, ...args].join(' ');
  sendToRenderer('download-started', { command: commandLine });

  return new Promise((resolve) => {
    const state = { lastFile: '', lastError: '' };
    const proc = spawn(ytDlpPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: paths.spawnEnv
    });
    currentProcess = {
      child: proc,
      cancelled: false,
      cancelReason: '',
      state
    };

    proc.stdout.setEncoding('utf-8');
    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) sendToRenderer('download-log', { text: line.trimEnd(), isError: false });
        parseDownloadLine(line, state, sendToRenderer);
      }
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        state.lastError = text;
        sendToRenderer('download-error-log', text);
        for (const line of text.split('\n')) {
          if (line.trim()) sendToRenderer('download-log', { text: line.trimEnd(), isError: true });
        }
      }
    });

    proc.on('close', async (code, signal) => {
      const processState = currentProcess;
      currentProcess = null;

      if (processState && processState.cancelled) {
        await removeDownloadArtifacts(processState.state ? processState.state.lastFile : state.lastFile);
        resolve({
          success: false,
          cancelled: true,
          reason: processState.cancelReason || 'Téléchargement annulé.'
        });
        return;
      }

      if (code === 0) {
        sendToRenderer('download-complete', { file: state.lastFile, folder: outputDir });
        await appendHistory({
          url,
          mode,
          title: isPlaylist ? (playlistTitle || url) : url,
          file: state.lastFile,
          folder: outputDir,
          timestamp: Date.now()
        });
        resolve({ success: true, file: state.lastFile });

        try {
          if (Notification.isSupported()) {
            new Notification({
              title: 'yt-dl',
              body: 'Téléchargement terminé !',
              silent: true
            }).show();
          }
        } catch {}
      } else {
        const reason = state.lastError || getExitReason(code, signal);
        sendToRenderer('download-failed', reason);
        resolve({ success: false, error: reason });
      }
    });

    proc.on('error', (err) => {
      currentProcess = null;
      sendToRenderer('download-failed', err.message);
      resolve({ success: false, error: err.message });
    });
  });
});

ipcMain.handle('cancel-download', () => {
  if (currentProcess) {
    currentProcess.cancelled = true;
    currentProcess.cancelReason = 'Téléchargement annulé par l\'utilisateur.';
    stopDownloadProcess(currentProcess);
    return true;
  }
  return false;
});
