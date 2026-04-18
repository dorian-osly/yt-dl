const fs = require('fs');
const fsp = fs.promises;
const paths = require('./paths');

const defaultSettings = {
  downloadFolder: null,
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
  embedThumbnail: true,
  devTools: false,
  verboseMode: false,
  writeSubs: false,
  subsLang: 'en',
  sponsorblockMark: '',
  disableGpu: false
};

async function readJson(filePath, fallbackValue) {
  try {
    const content = await fsp.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return fallbackValue;
  }
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

async function loadSettings() {
  const app = paths.getApp();
  const base = { ...defaultSettings, downloadFolder: app.getPath('downloads') };
  const saved = await readJson(paths.getSettingsPath(), {});
  return { ...base, ...saved };
}

async function saveSettings(settings) {
  await writeJson(paths.getSettingsPath(), settings);
}

async function loadHistory() {
  return readJson(paths.getHistoryPath(), []);
}

async function appendHistory(entry) {
  const history = await loadHistory();
  history.unshift(entry);
  if (history.length > 200) history.length = 200;
  await writeJson(paths.getHistoryPath(), history);
}

async function clearHistory() {
  await writeJson(paths.getHistoryPath(), []);
}

async function loadQueue() {
  return readJson(paths.getQueuePath(), []);
}

async function saveQueue(queue) {
  const persistable = queue.map(i => ({
    url: i.url,
    mode: i.mode,
    title: i.title,
    isPlaylist: i.isPlaylist,
    playlistTitle: i.playlistTitle,
    perVideoSettings: i.perVideoSettings,
    status: i.status
  }));
  await writeJson(paths.getQueuePath(), persistable);
}

module.exports = {
  defaultSettings,
  readJson,
  writeJson,
  loadSettings,
  saveSettings,
  loadHistory,
  appendHistory,
  clearHistory,
  loadQueue,
  saveQueue
};
