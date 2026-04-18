const path = require('path');
const fs = require('fs');

let _binDir = null;
let _settingsPath = null;
let _historyPath = null;
let _queuePath = null;
let _ytDlpPath = null;
let _ffmpegPath = null;
let _ffmpegZipPath = null;
let _ffprobePath = null;
let _denoPath = null;
let _denoZipPath = null;

function getApp() {
  const { app } = require('electron');
  return app;
}

function getBinDir() {
  if (!_binDir) {
    _binDir = path.join(getApp().getPath('userData'), 'bin');
  }
  return _binDir;
}

function getSettingsPath() {
  if (!_settingsPath) {
    _settingsPath = path.join(getApp().getPath('userData'), 'settings.json');
  }
  return _settingsPath;
}

function getHistoryPath() {
  if (!_historyPath) {
    _historyPath = path.join(getApp().getPath('userData'), 'history.json');
  }
  return _historyPath;
}

function getQueuePath() {
  if (!_queuePath) {
    _queuePath = path.join(getApp().getPath('userData'), 'queue.json');
  }
  return _queuePath;
}

function getYtDlpPath() {
  if (!_ytDlpPath) {
    const isWin = process.platform === 'win32';
    _ytDlpPath = path.join(getBinDir(), isWin ? 'yt-dlp.exe' : 'yt-dlp');
  }
  return _ytDlpPath;
}

function getFfmpegPath() {
  if (!_ffmpegPath) {
    const isWin = process.platform === 'win32';
    _ffmpegPath = path.join(getBinDir(), isWin ? 'ffmpeg.exe' : 'ffmpeg');
  }
  return _ffmpegPath;
}

function getFfmpegZipPath() {
  if (!_ffmpegZipPath) {
    const isWin = process.platform === 'win32';
    _ffmpegZipPath = path.join(getBinDir(), isWin ? 'ffmpeg.zip' : 'ffmpeg.tar.xz');
  }
  return _ffmpegZipPath;
}

function getFfprobePath() {
  if (!_ffprobePath) {
    const isWin = process.platform === 'win32';
    _ffprobePath = path.join(getBinDir(), isWin ? 'ffprobe.exe' : 'ffprobe');
  }
  return _ffprobePath;
}

function getDenoPath() {
  if (!_denoPath) {
    const isWin = process.platform === 'win32';
    _denoPath = path.join(getBinDir(), isWin ? 'deno.exe' : 'deno');
  }
  return _denoPath;
}

function getDenoZipPath() {
  if (!_denoZipPath) {
    const isWin = process.platform === 'win32';
    _denoZipPath = path.join(getBinDir(), isWin ? 'deno.zip' : 'deno.zip');
  }
  return _denoZipPath;
}

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const themesDir = path.join(__dirname, '..', '..', 'assets', 'themes');

const spawnEnv = {
  ...process.env,
  PYTHONIOENCODING: 'utf-8',
  PYTHONUTF8: '1'
};

module.exports = {
  getApp,
  getBinDir,
  getSettingsPath,
  getHistoryPath,
  getQueuePath,
  getYtDlpPath,
  getFfmpegPath,
  getFfmpegZipPath,
  getFfprobePath,
  getDenoPath,
  getDenoZipPath,
  isWin,
  isMac,
  themesDir,
  spawnEnv
};
