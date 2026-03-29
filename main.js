const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

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

const userDataPath = app.getPath('userData');
const binDir = path.join(userDataPath, 'bin');
const settingsPath = path.join(userDataPath, 'settings.json');
const themesDir = path.join(__dirname, 'assets', 'themes');
const ytDlpPath = path.join(binDir, 'yt-dlp.exe');
const ffmpegPath = path.join(binDir, 'ffmpeg.exe');
const ffmpegZipPath = path.join(binDir, 'ffmpeg.zip');
const spawnEnv = {
  ...process.env,
  PYTHONIOENCODING: 'utf-8',
  PYTHONUTF8: '1'
};

const defaultSettings = {
  downloadFolder: app.getPath('downloads'),
  theme: 'dark',
  customTheme: 'default',
  language: 'auto',
  animations: 'enabled',
  videoQuality: 'best',
  videoCodec: 'h264',
  videoContainer: 'auto',
  audioFormat: 'best',
  audioBitrate: '320',
  audioTrack: 'auto',
  devTools: false
};

const binarySources = [
  {
    existsAt: ytDlpPath,
    downloadTo: ytDlpPath,
    label: 'yt-dlp',
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  },
  {
    existsAt: ffmpegPath,
    downloadTo: ffmpegZipPath,
    label: 'ffmpeg',
    url: 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
  }
];

function readJson(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallbackValue;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallbackValue;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function loadSettings() {
  return {
    ...defaultSettings,
    ...readJson(settingsPath, {})
  };
}

function saveSettings(settings) {
  writeJson(settingsPath, settings);
}

function ensureBinDir() {
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
}

function createThemeAssetPath(themeId, fileName) {
  return `../assets/themes/${encodeURIComponent(themeId)}/${encodeURIComponent(fileName)}`;
}

function getThemeFontDescriptor(themeId, themePath) {
  const fontCandidates = [
    { fileName: 'font.ttf', format: 'truetype' },
    { fileName: 'font.otf', format: 'opentype' }
  ];

  for (const candidate of fontCandidates) {
    if (fs.existsSync(path.join(themePath, candidate.fileName))) {
      return {
        fontPath: createThemeAssetPath(themeId, candidate.fileName),
        fontFormat: candidate.format
      };
    }
  }

  return {
    fontPath: null,
    fontFormat: null
  };
}

function getThemeMetadata(themePath) {
  const metaPath = path.join(themePath, 'theme.json');
  try {
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Error reading theme.json:', error);
  }
  return {};
}

function formatThemeLabel(themeId) {
  return themeId
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function listThemes() {
  try {
    if (!fs.existsSync(themesDir)) {
      return [];
    }

    return fs.readdirSync(themesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const themeId = entry.name;
        const themePath = path.join(themesDir, themeId);
        const cssFileName = 'theme.css';
        const backgroundFileName = 'background.png';
        const iconFileName = 'icon.png';
        const bannerFileName = 'banner.png';
        const hasStylesheet = fs.existsSync(path.join(themePath, cssFileName));

        if (!hasStylesheet) {
          return null;
        }

        const hasBackground = fs.existsSync(path.join(themePath, backgroundFileName));
        const hasIcon = fs.existsSync(path.join(themePath, iconFileName));
        const hasBanner = fs.existsSync(path.join(themePath, bannerFileName));
        const { fontPath, fontFormat } = getThemeFontDescriptor(themeId, themePath);
        const meta = getThemeMetadata(themePath);

        return {
          id: themeId,
          label: formatThemeLabel(themeId),
          stylesheetPath: createThemeAssetPath(themeId, cssFileName),
          backgroundPath: hasBackground ? createThemeAssetPath(themeId, backgroundFileName) : null,
          iconPath: hasIcon ? createThemeAssetPath(themeId, iconFileName) : null,
          bannerPath: hasBanner ? createThemeAssetPath(themeId, bannerFileName) : null,
          fontPath,
          fontFormat,
          customPhrases: Array.isArray(meta.customPhrases) ? meta.customPhrases : meta.customPhrase ? [meta.customPhrase] : null
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.label.localeCompare(right.label, 'fr', { sensitivity: 'base' }));
  } catch (error) {
    console.error('Theme listing error:', error);
    return [];
  }
}

function followRedirects(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { headers: { 'User-Agent': 'YTDownloader/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        followRedirects(res.headers.location).then(resolve).catch(reject);
      } else if (res.statusCode === 200) {
        resolve(res);
      } else {
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    }).on('error', reject);
  });
}

function downloadFile(url, dest, win, label) {
  return new Promise(async (resolve, reject) => {
    try {
      ensureBinDir();
      const res = await followRedirects(url);
      const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
      let downloadedBytes = 0;
      const file = fs.createWriteStream(dest);
      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        file.write(chunk);
        if (totalBytes > 0 && win) {
          const pct = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          win.webContents.send('setup-progress', { label, percent: pct });
        }
      });
      res.on('end', () => {
        file.end();
        file.on('finish', resolve);
      });
      res.on('error', (err) => {
        file.close();
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function ensureBinaries(win) {
  ensureBinDir();
  const needed = binarySources.filter((item) => !fs.existsSync(item.existsAt));
  if (needed.length === 0) return true;

  for (const item of needed) {
    if (win) win.webContents.send('setup-progress', { label: item.label, percent: '0' });
    await downloadFile(item.url, item.downloadTo, win, item.label);
  }

  if (fs.existsSync(ffmpegZipPath) && !fs.existsSync(ffmpegPath)) {
    if (win) win.webContents.send('setup-progress', { label: 'ffmpeg', percent: '99' });
    await extractFfmpegFromZip(ffmpegZipPath);
    try { fs.unlinkSync(ffmpegZipPath); } catch {}
  }

  if (win) win.webContents.send('setup-complete');
  return true;
}

async function extractFfmpegFromZip(zipPath) {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell', [
      '-NoProfile', '-Command',
      `
      $zip = '${zipPath.replace(/'/g, "''")}';
      $dest = '${binDir.replace(/'/g, "''")}';
      Add-Type -AssemblyName System.IO.Compression.FileSystem;
      $archive = [System.IO.Compression.ZipFile]::OpenRead($zip);
      foreach ($entry in $archive.Entries) {
        if ($entry.Name -eq 'ffmpeg.exe') {
          $stream = $entry.Open();
          $fileStream = [System.IO.File]::Create("$dest\\ffmpeg.exe");
          $stream.CopyTo($fileStream);
          $fileStream.Close();
          $stream.Close();
          break;
        }
        if ($entry.Name -eq 'ffprobe.exe') {
          $stream = $entry.Open();
          $fileStream = [System.IO.File]::Create("$dest\\ffprobe.exe");
          $stream.CopyTo($fileStream);
          $fileStream.Close();
          $stream.Close();
        }
      }
      $archive.Dispose();
      `
    ], { stdio: 'pipe' });
    ps.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg extraction failed (code ${code})`));
    });
    ps.on('error', reject);
  });
}

let mainWindow;

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
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
      const settings = loadSettings();
      if (settings.devTools) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      }
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    ensureBinaries(mainWindow).catch((err) => {
      mainWindow.webContents.send('setup-error', err.message);
    });
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('list-themes', () => listThemes());

ipcMain.handle('save-settings', (_e, settings) => {
  const current = loadSettings();
  const merged = { ...current, ...settings };
  saveSettings(merged);
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
      const data = fs.readFileSync(result.filePaths[0], 'utf-8');
      const imported = JSON.parse(data);
      const merged = { ...loadSettings(), ...imported };
      saveSettings(merged);
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
      const current = loadSettings();
      fs.writeFileSync(result.filePath, JSON.stringify(current, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error('Export error:', e);
      return false;
    }
  }
  return false;
});

ipcMain.handle('reset-config', () => {
  saveSettings(defaultSettings);
  return defaultSettings;
});

ipcMain.handle('open-folder', (_e, folderPath) => {
  shell.openPath(folderPath);
});

ipcMain.handle('check-binaries', () => {
  return fs.existsSync(ytDlpPath) && fs.existsSync(ffmpegPath);
});

ipcMain.handle('get-video-title', async (_e, url) => {
  return new Promise((resolve) => {
    const proc = spawn(ytDlpPath, ['--dump-json', '--no-playlist', '--no-download', url], { 
      stdio: ['pipe', 'pipe', 'pipe'],
      env: spawnEnv
    });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString('utf8'); });
    proc.on('close', () => {
      try {
        const lines = out.trim().split('\n');
        const info = JSON.parse(lines[0]);
        const title = info.title || 'Inconnu';
        const channel = info.uploader || '';
        resolve(channel ? `${title} - ${channel}` : title);
      } catch (err) {
        resolve(url);
      }
    });
    proc.on('error', () => resolve(url));
    setTimeout(() => { try { proc.kill(); } catch {} resolve(url); }, 15000);
  });
});

let currentProcess = null;

function getExitReason(code, signal) {
  if (signal) {
    return `Processus interrompu (${signal})`;
  }

  return `Code de sortie: ${code}`;
}

function buildVideoFormat(settings) {
  const heightFilter = settings.videoQuality && settings.videoQuality !== 'best'
    ? `[height<=${settings.videoQuality}]`
    : '';

  let preferredVideo = `bestvideo${heightFilter}`;
  if (settings.videoCodec === 'av1') {
    preferredVideo = `bestvideo[vcodec^=av01]${heightFilter}`;
  } else if (settings.videoCodec === 'vp9') {
    preferredVideo = `bestvideo[vcodec^=vp9]${heightFilter}`;
  } else if (settings.videoCodec === 'h264') {
    preferredVideo = `bestvideo[vcodec^=avc1]${heightFilter}`;
  }

  const fallbackVideo = `bestvideo${heightFilter}`;
  const language = settings.audioTrack;

  if (language && language !== 'auto') {
    return [
      `${preferredVideo}+bestaudio[language=${language}]`,
      `${fallbackVideo}+bestaudio[language=${language}]`,
      `${fallbackVideo}+bestaudio`,
      `best${heightFilter}`,
      'best'
    ].join('/');
  }

  return [
    `${preferredVideo}+bestaudio`,
    `${fallbackVideo}+bestaudio`,
    `best${heightFilter}`,
    'best'
  ].join('/');
}

function buildVideoArgs(url, settings, outputTemplate) {
  const args = [
    '-f', buildVideoFormat(settings),
    '-o', outputTemplate,
    '--ffmpeg-location', binDir,
    '--newline',
    '--no-mtime'
  ];

  if (settings.videoContainer === 'auto') {
    args.push('--merge-output-format', 'mkv');
  } else {
    args.push('--merge-output-format', settings.videoContainer);
    if (settings.videoContainer === 'mp4') {
      args.push('--remux-video', 'mp4');
    }
  }

  args.push(url);
  return args;
}

function buildAudioArgs(url, settings, outputTemplate) {
  const args = [
    '-x',
    '-o', outputTemplate,
    '--ffmpeg-location', binDir,
    '--newline',
    '--no-mtime'
  ];

  if (settings.audioFormat && settings.audioFormat !== 'best') {
    args.push('--audio-format', settings.audioFormat);
    args.push('--audio-quality', settings.audioBitrate ? `${settings.audioBitrate}K` : '0');
  }

  args.push(url);
  return args;
}

function buildDownloadArgs(url, mode, settings) {
  const outputDir = settings.downloadFolder || app.getPath('downloads');
  const outputTemplate = path.join(outputDir, '%(title)s - %(uploader)s.%(ext)s');

  return {
    args: mode === 'video'
      ? buildVideoArgs(url, settings, outputTemplate)
      : buildAudioArgs(url, settings, outputTemplate),
    outputDir
  };
}

function collectDownloadArtifacts(filePath) {
  if (!filePath) {
    return [];
  }

  const artifacts = new Set([
    filePath,
    `${filePath}.part`,
    `${filePath}.ytdl`
  ]);

  if (filePath.endsWith('.part')) {
    artifacts.add(filePath.slice(0, -5));
  }

  return [...artifacts];
}

function removeDownloadArtifacts(filePath) {
  for (const artifactPath of collectDownloadArtifacts(filePath)) {
    try {
      if (fs.existsSync(artifactPath)) {
        fs.unlinkSync(artifactPath);
      }
    } catch (error) {
      console.error('Artifact cleanup error:', artifactPath, error);
    }
  }
}

function stopDownloadProcess(processRef) {
  if (!processRef || !processRef.child || processRef.child.killed) {
    return;
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(processRef.child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true
    });
    return;
  }

  processRef.child.kill('SIGKILL');
}

function parseDownloadLine(line, state) {
  const progressMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+(\S+)/);
  if (progressMatch) {
    sendToRenderer('download-progress', {
      percent: parseFloat(progressMatch[1]),
      size: progressMatch[2],
      speed: progressMatch[3],
      eta: progressMatch[4]
    });
  }

  const destMatch = line.match(/\[(?:Merger|ExtractAudio|download)\] Destination: (.+)/);
  if (destMatch) {
    state.lastFile = destMatch[1].trim();
  }

  const alreadyMatch = line.match(/\[download\] (.+) has already been downloaded/);
  if (alreadyMatch) {
    state.lastFile = alreadyMatch[1].trim();
  }

  if (/\[download\]\s+100%/.test(line)) {
    sendToRenderer('download-progress', {
      percent: 100,
      size: '',
      speed: '',
      eta: ''
    });
  }
}

ipcMain.handle('start-download', async (_e, { url, mode }) => {
  if (currentProcess) {
    return { success: false, error: 'Un téléchargement est déjà en cours.' };
  }

  const settings = loadSettings();
  const { args, outputDir } = buildDownloadArgs(url, mode, settings);

  return new Promise((resolve) => {
    const state = { lastFile: '', lastError: '' };
    const proc = spawn(ytDlpPath, args, { 
      stdio: ['pipe', 'pipe', 'pipe'],
      env: spawnEnv
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
        parseDownloadLine(line, state);
      }
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        state.lastError = text;
        sendToRenderer('download-error-log', text);
      }
    });

    proc.on('close', (code, signal) => {
      const processState = currentProcess;
      currentProcess = null;

      if (processState && processState.cancelled) {
        removeDownloadArtifacts(processState.state ? processState.state.lastFile : state.lastFile);
        resolve({
          success: false,
          cancelled: true,
          reason: processState.cancelReason || 'Téléchargement annulé.'
        });
        return;
      }

      if (code === 0) {
        sendToRenderer('download-complete', { file: state.lastFile, folder: outputDir });
        resolve({ success: true, file: state.lastFile });
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
    currentProcess.cancelReason = 'Téléchargement annulé par l’utilisateur.';
    stopDownloadProcess(currentProcess);
    return true;
  }
  return false;
});
