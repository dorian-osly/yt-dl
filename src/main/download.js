const { spawn } = require('child_process');
const path = require('path');
const fsp = require('fs').promises;
const paths = require('./paths');

function isValidYouTubeUrl(url) {
  const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?|shorts\/|embed\/|v\/|playlist\?)|youtu\.be\/|music\.youtube\.com\/watch\?)/;
  return pattern.test(url.trim());
}

function getExitReason(code, signal) {
  if (signal) return `Processus interrompu (${signal})`;
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
    '--ffmpeg-location', paths.getBinDir(),
    '--newline',
    '--no-mtime',
    '--js-runtimes', `deno:${paths.getDenoPath()}`
  ];

  if (settings.videoContainer === 'auto') {
    args.push('--merge-output-format', 'mkv');
  } else {
    args.push('--merge-output-format', settings.videoContainer);
    if (settings.videoContainer === 'mp4') {
      args.push('--remux-video', 'mp4');
    }
  }

  if (settings.writeSubs) {
    args.push('--write-subs');
    if (settings.subsLang && settings.subsLang !== 'auto') {
      args.push('--sub-langs', settings.subsLang);
    }
    args.push('--convert-subs', 'srt');
  }

  if (settings.sponsorblockMark) {
    args.push('--sponsorblock-mark', settings.sponsorblockMark);
  }

  args.push(url);
  return args;
}

function buildAudioArgs(url, settings, outputTemplate) {
  const args = [
    '-x',
    '-o', outputTemplate,
    '--ffmpeg-location', paths.getBinDir(),
    '--newline',
    '--no-mtime',
    '--js-runtimes', `deno:${paths.getDenoPath()}`
  ];

  if (settings.audioFormat && settings.audioFormat !== 'best') {
    args.push('--audio-format', settings.audioFormat);
    args.push('--audio-quality', settings.audioBitrate ? `${settings.audioBitrate}K` : '0');
  }

  if (settings.embedThumbnail !== false) {
    args.push('--embed-thumbnail', '--convert-thumbnail', 'jpg');
  }

  args.push(url);
  return args;
}

function sanitizeFolderName(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.+$/, '')
    .trim()
    .slice(0, 150) || 'Playlist';
}

function buildDownloadArgs(url, mode, settings, isPlaylist = false, playlistTitle = null) {
  const app = paths.getApp();
  const outputDir = settings.downloadFolder || app.getPath('downloads');
  let outputTemplate;
  if (isPlaylist) {
    const folderName = playlistTitle ? sanitizeFolderName(playlistTitle) : '%(playlist_title)s';
    outputTemplate = path.join(outputDir, folderName, '%(playlist_index)s - %(title)s.%(ext)s');
  } else {
    outputTemplate = path.join(outputDir, '%(title)s - %(uploader)s.%(ext)s');
  }

  const argsInfo = mode === 'video'
    ? buildVideoArgs(url, settings, outputTemplate)
    : buildAudioArgs(url, settings, outputTemplate);

  if (isPlaylist) {
    argsInfo.splice(argsInfo.length - 1, 0, '--yes-playlist');
  } else {
    argsInfo.splice(argsInfo.length - 1, 0, '--no-playlist');
  }

  return { args: argsInfo, outputDir };
}

function collectDownloadArtifacts(filePath) {
  if (!filePath) return [];
  const artifacts = new Set([filePath, `${filePath}.part`, `${filePath}.ytdl`]);
  if (filePath.endsWith('.part')) artifacts.add(filePath.slice(0, -5));
  return [...artifacts];
}

async function removeDownloadArtifacts(filePath) {
  for (const artifactPath of collectDownloadArtifacts(filePath)) {
    try { await fsp.unlink(artifactPath); } catch {}
  }
}

function stopDownloadProcess(processRef) {
  if (!processRef || !processRef.child || processRef.child.killed) return;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(processRef.child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true
    });
    return;
  }

  processRef.child.kill('SIGKILL');
}

function parseDownloadLine(line, state, sendToRenderer) {
  const progressMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+(\S+)/);
  if (progressMatch) {
    sendToRenderer('download-progress', {
      percent: parseFloat(progressMatch[1]),
      size: progressMatch[2],
      speed: progressMatch[3],
      eta: progressMatch[4],
      playlistItem: state.playlistItem || null,
      playlistTotal: state.playlistTotal || null
    });
  }

  const playlistMatch = line.match(/\[download\]\s+Downloading item (\d+) of (\d+)/i);
  if (playlistMatch) {
    state.playlistItem = parseInt(playlistMatch[1], 10);
    state.playlistTotal = parseInt(playlistMatch[2], 10);
    sendToRenderer('download-progress', {
      percent: 0,
      size: '',
      speed: '',
      eta: '',
      playlistItem: state.playlistItem,
      playlistTotal: state.playlistTotal
    });
  }

  const destMatch = line.match(/\[(?:Merger|ExtractAudio|download)\] Destination: (.+)/);
  if (destMatch) state.lastFile = destMatch[1].trim();

  const alreadyMatch = line.match(/\[download\] (.+) has already been downloaded/);
  if (alreadyMatch) state.lastFile = alreadyMatch[1].trim();

  if (/\[download\]\s+100%/.test(line)) {
    sendToRenderer('download-progress', {
      percent: 100,
      size: '',
      speed: '',
      eta: ''
    });
  }
}

async function getVideoTitle(url) {
  return new Promise((resolve) => {
    const proc = spawn(paths.getYtDlpPath(), ['--dump-json', '--no-playlist', '--no-download', '--js-runtimes', `deno:${paths.getDenoPath()}`, url], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: paths.spawnEnv
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
      } catch {
        resolve(url);
      }
    });
    proc.on('error', () => resolve(url));
    setTimeout(() => { try { proc.kill(); } catch {} resolve(url); }, 15000);
  });
}

async function getVideoInfo(url) {
  return new Promise((resolve) => {
    const proc = spawn(paths.getYtDlpPath(), ['--dump-single-json', '--flat-playlist', '--no-download', '--js-runtimes', `deno:${paths.getDenoPath()}`, url], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: paths.spawnEnv
    });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString('utf8'); });
    proc.on('close', () => {
      try {
        const info = JSON.parse(out.trim());
        const title = info.title || 'Inconnu';

        if (info._type === 'playlist') {
          resolve({
            isPlaylist: true,
            title,
            channel: info.uploader || info.extractor || '',
            videoCount: info.entries ? info.entries.length : 0,
            thumbnail: info.thumbnails && info.thumbnails.length ? info.thumbnails[info.thumbnails.length - 1].url : null,
            size: 0,
            duration: 0
          });
        } else {
          const channel = info.uploader || '';
          const duration = info.duration || 0;
          const thumbnail = info.thumbnail || '';
          let size = info.filesize || info.filesize_approx || 0;
          resolve({ isPlaylist: false, title, channel, duration, thumbnail, size });
        }
      } catch {
        resolve(null);
      }
    });
    proc.on('error', () => resolve(null));
    setTimeout(() => { try { proc.kill(); } catch {} resolve(null); }, 25000);
  });
}

async function getYtdlpVersion() {
  try {
    await fsp.access(paths.getYtDlpPath());
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const proc = spawn(paths.getYtDlpPath(), ['--version'], { stdio: ['pipe', 'pipe', 'pipe'], env: paths.spawnEnv });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString('utf8'); });
    proc.on('close', () => resolve(out.trim() || null));
    proc.on('error', () => resolve(null));
    setTimeout(() => { try { proc.kill(); } catch {} resolve(null); }, 5000);
  });
}

module.exports = {
  isValidYouTubeUrl,
  getExitReason,
  buildDownloadArgs,
  removeDownloadArtifacts,
  stopDownloadProcess,
  parseDownloadLine,
  getVideoTitle,
  getVideoInfo,
  getYtdlpVersion
};
