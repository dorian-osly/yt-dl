let currentMode = 'video';
let isDownloading = false;
let queue = [];
let queueIdCounter = 0;
let processingQueue = false;
let availableThemes = [];
let selectedCustomThemeId = 'default';
let preferredThemeMode = 'dark';

const urlInput = document.getElementById('url-input');
const urlError = document.getElementById('url-error');
const pasteBtn = document.getElementById('paste-btn');
const modeVideo = document.getElementById('mode-video');
const modeAudio = document.getElementById('mode-audio');
const downloadBtn = document.getElementById('download-btn');
const cancelBtn = document.getElementById('cancel-btn');
const statusSection = document.getElementById('status-section');
const statusMessage = document.getElementById('status-message');
const openSettings = document.getElementById('open-settings');
const closeSettings = document.getElementById('close-settings');
const screenMain = document.getElementById('screen-main');
const screenSettings = document.getElementById('screen-settings');
const folderPath = document.getElementById('folder-path');
const changeFolder = document.getElementById('change-folder');
const setupOverlay = document.getElementById('setup-overlay');
const setupLabel = document.getElementById('setup-label');
const setupProgressBar = document.getElementById('setup-progress-bar');
const queuePanel = document.getElementById('queue-panel');
const queueList = document.getElementById('queue-list');
const queueBadge = document.getElementById('queue-badge');

const videoPreview = document.getElementById('video-preview');
const previewThumbnail = document.getElementById('preview-thumbnail');
const previewTitle = document.getElementById('preview-title');
const previewChannel = document.getElementById('preview-channel');
const previewDuration = document.getElementById('preview-duration');
const previewSize = document.getElementById('preview-size');
let previewDebounce = null;

// Per-video settings
const perVideoSettings = document.getElementById('per-video-settings');
const perVideoToggle = document.getElementById('per-video-toggle');
const pvVideoOpts = document.getElementById('pv-video-opts');
const pvAudioOpts = document.getElementById('pv-audio-opts');
const pvQuality = document.getElementById('pv-quality');
const pvCodec = document.getElementById('pv-codec');
const pvContainer = document.getElementById('pv-container');
const pvAudioFormat = document.getElementById('pv-audio-format');
const pvAudioBitrate = document.getElementById('pv-audio-bitrate');
let perVideoVisible = false;

// Debug
const logConsole = document.getElementById('log-console');
let logLines = [];
let lastCommand = '';
let verboseModeEnabled = false;
const queueRingProgress = document.getElementById('queue-ring-progress');
const openQueueBtn = document.getElementById('open-queue');
const clearQueueBtn = document.getElementById('clear-queue');
const themeGrid = document.getElementById('theme-grid');
const themeEmpty = document.getElementById('theme-empty');
const customThemeStylesheet = document.getElementById('custom-theme-stylesheet');
const customThemeFontStyle = document.getElementById('custom-theme-font-style');

const SETTINGS_GROUP_IDS = [
  'setting-language',
  'setting-animations',
  'setting-video-quality',
  'setting-video-codec',
  'setting-video-container',
  'setting-audio-format',
  'setting-audio-bitrate',
  'setting-audio-track'
];

function isValidYouTubeUrl(url) {
  const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?|shorts\/|embed\/|v\/|playlist\?)|youtu\.be\/|music\.youtube\.com\/watch\?)/;
  return pattern.test(url.trim());
}

function getSettingKey(id) {
  return id.replace('setting-', '').replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function getThemeById(themeId) {
  return availableThemes.find((theme) => theme.id === themeId) || null;
}

function setThemeAssetVariable(variableName, assetPath) {
  document.documentElement.style.setProperty(variableName, assetPath ? `url("${assetPath}")` : 'none');
}

function escapeFontFamily(value) {
  return String(value).replace(/[^a-z0-9_-]/gi, '_');
}

function applyCustomThemeFont(theme) {
  if (!customThemeFontStyle) {
    return;
  }

  if (!theme || !theme.fontPath || !theme.fontFormat) {
    customThemeFontStyle.textContent = '';
    document.documentElement.style.removeProperty('--font');
    return;
  }

  const familyName = `theme_${escapeFontFamily(theme.id)}`;
  customThemeFontStyle.textContent = [
    '@font-face {',
    `  font-family: "${familyName}";`,
    `  src: url("${theme.fontPath}") format("${theme.fontFormat}");`,
    '  font-display: swap;',
    '}',
    `html[data-custom-theme="${theme.id}"] {`,
    `  --font: "${familyName}", 'Space Mono', 'Courier New', Courier, monospace;`,
    '}'
  ].join('\n');
}

function applyCustomPhrase(theme) {
  const mainTitle = document.querySelector('.main-title');
  if (!mainTitle) return;

  if (theme && theme.customPhrases && theme.customPhrases.length > 0) {
    const index = Math.floor(Math.random() * theme.customPhrases.length);
    mainTitle.textContent = theme.customPhrases[index];
  } else {
    const t = translations[currentLang] || translations.fr;
    mainTitle.textContent = t.mainTitle;
  }
}

function getEffectiveThemeMode(themeMode = preferredThemeMode) {
  return selectedCustomThemeId === 'default' ? themeMode : 'dark';
}

function updateThemeToggleState() {
  const toggle = document.getElementById('setting-theme-toggle');
  if (!toggle) {
    return;
  }

  const customThemeActive = selectedCustomThemeId !== 'default';
  toggle.disabled = customThemeActive;
  toggle.checked = getEffectiveThemeMode() === 'dark';
  toggle.closest('.toggle-switch')?.classList.toggle('disabled', customThemeActive);
}

function syncThemeMode({ persist = false } = {}) {
  document.documentElement.setAttribute('data-theme', getEffectiveThemeMode());
  updateThemeToggleState();

  if (persist) {
    window.api.saveSettings({ theme: preferredThemeMode });
  }
}

function applyCustomTheme(themeId) {
  const nextThemeId = themeId && getThemeById(themeId) ? themeId : 'default';
  const theme = getThemeById(nextThemeId);

  selectedCustomThemeId = nextThemeId;
  customThemeStylesheet.setAttribute('href', theme ? theme.stylesheetPath : '');
  customThemeStylesheet.disabled = !theme;
  document.body.classList.toggle('theme-has-background', Boolean(theme && theme.backgroundPath));
  document.body.classList.toggle('theme-has-icon', Boolean(theme && theme.iconPath));
  document.documentElement.setAttribute('data-custom-theme', nextThemeId);

  setThemeAssetVariable('--theme-background-image', theme ? theme.backgroundPath : null);
  setThemeAssetVariable('--theme-icon-image', theme ? theme.iconPath : null);
  setThemeAssetVariable('--theme-banner-image', theme ? theme.bannerPath : null);
  applyCustomThemeFont(theme);
  applyCustomPhrase(theme);
  syncThemeMode();
}

function createThemeCard(theme) {
  const button = document.createElement('button');
  button.className = 'theme-card';
  button.type = 'button';
  button.classList.toggle('active', theme.id === selectedCustomThemeId);

  const preview = document.createElement('div');
  preview.className = 'theme-card-preview';
  const previewImage = theme.bannerPath || theme.backgroundPath;
  if (previewImage) {
    preview.style.backgroundImage = `url("${previewImage}")`;
    preview.classList.add('has-image');
  }

  if (theme.iconPath) {
    const icon = document.createElement('span');
    icon.className = 'theme-card-icon';
    icon.style.backgroundImage = `url("${theme.iconPath}")`;
    preview.appendChild(icon);
  }

  const body = document.createElement('div');
  body.className = 'theme-card-body';

  const title = document.createElement('div');
  title.className = 'theme-card-title';
  title.textContent = theme.label;
  body.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'theme-card-meta';
  meta.textContent = theme.meta;
  body.appendChild(meta);

  button.appendChild(preview);
  button.appendChild(body);

  button.addEventListener('click', async () => {
    selectedCustomThemeId = theme.id;
    applyCustomTheme(theme.id);
    renderThemeCards();
    await window.api.saveSettings({ customTheme: theme.id });
  });

  return button;
}

function renderThemeCards() {
  if (!themeGrid) {
    return;
  }

  const t = translations[currentLang];
  themeGrid.innerHTML = '';

  themeGrid.appendChild(createThemeCard({
    id: 'default',
    label: t.themeDefaultName,
    meta: t.themeDefaultDesc,
    bannerPath: null,
    backgroundPath: null,
    iconPath: null
  }));

  for (const theme of availableThemes) {
    themeGrid.appendChild(createThemeCard({
      ...theme,
      meta: theme.id
    }));
  }

  if (themeEmpty) {
    themeEmpty.classList.toggle('hidden', availableThemes.length > 0);
  }
}

async function refreshThemes(selectedThemeId) {
  availableThemes = await window.api.listThemes();
  applyCustomTheme(selectedThemeId || selectedCustomThemeId);
  renderThemeCards();

  if (selectedThemeId && selectedThemeId !== 'default' && !getThemeById(selectedThemeId)) {
    await window.api.saveSettings({ customTheme: 'default' });
  }
}

function showError(msg) {
  urlInput.classList.add('error');
  urlError.textContent = msg;
  urlError.classList.remove('hidden');
}

function hideError() {
  urlInput.classList.remove('error');
  urlError.classList.add('hidden');
}

function showStatus(msg, type) {
  statusMessage.textContent = msg;
  statusMessage.className = 'status-message ' + (type || 'success');
  statusSection.classList.remove('hidden');
}

function hideStatus() {
  statusSection.classList.add('hidden');
  statusMessage.textContent = '';
  statusMessage.className = 'status-message';
}

function setQueuePanelVisibility(visible) {
  queuePanel.classList.toggle('hidden', !visible);
}

function setScreen(screen) {
  const showSettings = screen === 'settings';

  screenMain.classList.toggle('active', !showSettings);
  screenMain.classList.toggle('left', showSettings);
  screenSettings.classList.toggle('active', showSettings);
  screenSettings.classList.toggle('right', !showSettings);
  openSettings.style.display = showSettings ? 'none' : '';
  openQueueBtn.style.display = showSettings ? 'none' : '';

  if (showSettings) {
    setQueuePanelVisibility(false);
  }
}

function getQueueDetailParts(item) {
  const parts = [];
  if (item.playlistItem && item.playlistTotal) {
    parts.push(`${item.playlistItem}/${item.playlistTotal}`);
  }
  parts.push(Math.round(item.percent || 0) + '%');
  if (item.speed) parts.push(item.speed);
  if (item.eta) parts.push('ETA ' + item.eta);
  return parts;
}

function getQueueDetailText(item) {
  return getQueueDetailParts(item).join(', ');
}

function getQueueResultDetail(item) {
  return item.reason || item.error || '';
}

function setDownloadingState(isDown) {
  isDownloading = isDown;
  if (isDown) {
    cancelBtn.classList.remove('hidden');
    downloadBtn.classList.add('hidden');
  } else {
    cancelBtn.classList.add('hidden');
    downloadBtn.classList.remove('hidden');
  }
}

const RING_CIRCUMFERENCE = 2 * Math.PI * 18;

function updateQueueBadge() {
  const activeCount = queue.filter(i => i.status === 'waiting' || i.status === 'active').length;
  if (activeCount > 0) {
    queueBadge.textContent = activeCount;
    queueBadge.classList.remove('hidden');
  } else {
    queueBadge.classList.add('hidden');
  }
}

function updateQueueRing(percent) {
  const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;
  queueRingProgress.style.strokeDashoffset = offset;
}

function renderQueue() {
  const t = translations[currentLang];
  queueList.innerHTML = '';

  const visibleItems = queue.filter(i => i.status !== 'removed');

  if (visibleItems.length === 0) {
    const emptyP = document.createElement('p');
    emptyP.className = 'queue-empty';
    emptyP.textContent = t.queueEmpty;
    queueList.appendChild(emptyP);
    updateQueueBadge();
    return;
  }

  for (const item of visibleItems) {
    const div = document.createElement('div');
    div.className = 'queue-item';
    div.setAttribute('data-queue-id', item.id);

    const header = document.createElement('div');
    header.className = 'queue-item-header';

    const icon = document.createElement('span');
    icon.className = 'queue-item-icon' + (item.status === 'active' ? ' active' : '');
    if (item.status === 'done') {
      icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (item.status === 'error') {
      icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    } else {
      icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    }
    header.appendChild(icon);

    const title = document.createElement('span');
    title.className = 'queue-item-title';
    title.textContent = item.title || item.url;
    header.appendChild(title);

    const status = document.createElement('span');
    status.className = 'queue-item-status';
    if (item.status === 'active') {
      status.classList.add('active');
      status.textContent = t.queueActive;
    } else if (item.status === 'waiting') {
      status.textContent = t.queueWaiting;
    } else if (item.status === 'done') {
      status.classList.add('done');
      status.textContent = t.queueDone;
    } else if (item.status === 'error') {
      status.classList.add('error');
      status.textContent = t.queueError;
    } else if (item.status === 'cancelled') {
      status.classList.add('cancelled');
      status.textContent = t.queueCancelled;
    }
    header.appendChild(status);

    if (item.status === 'active') {
      const cBtn = document.createElement('button');
      cBtn.className = 'queue-cancel-btn btn-icon';
      cBtn.title = 'Annuler';
      cBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      cBtn.onclick = (e) => {
        e.stopPropagation();
        window.api.cancelDownload();
      };
      header.appendChild(cBtn);
    }

    div.appendChild(header);

    if (item.status === 'active') {
      const detail = document.createElement('div');
      detail.className = 'queue-item-detail';
      detail.textContent = getQueueDetailText(item);
      div.appendChild(detail);
    }

    if (item.status === 'error' || item.status === 'cancelled') {
      const detail = document.createElement('div');
      detail.className = 'queue-item-detail';
      detail.textContent = getQueueResultDetail(item);
      div.appendChild(detail);
    }

    if (item.status === 'active' || item.status === 'done') {
      const pw = document.createElement('div');
      pw.className = 'queue-item-progress';
      const bar = document.createElement('div');
      bar.className = 'queue-item-progress-bar';
      bar.style.width = (item.status === 'done' ? 100 : (item.percent || 0)) + '%';
      pw.appendChild(bar);
      div.appendChild(pw);
    }

    queueList.appendChild(div);
  }
  updateQueueBadge();
}

async function processQueue() {
  if (processingQueue) return;
  processingQueue = true;

  while (true) {
    const next = queue.find(i => i.status === 'waiting');
    if (!next) break;

    next.status = 'active';
    renderQueue();
    setDownloadingState(true);

    try {
      const result = await window.api.startDownload({
        url: next.url,
        mode: next.mode,
        isPlaylist: next.isPlaylist,
        playlistTitle: next.playlistTitle,
        perVideoSettings: next.perVideoSettings || null,
        verboseMode: verboseModeEnabled
      });

      if (result.success) {
        next.status = 'done';
        next.percent = 100;
      } else if (result.cancelled) {
        next.status = 'cancelled';
        next.reason = result.reason;
        next.speed = '';
        next.eta = '';
        showStatus(result.reason, 'cancelled');
      } else {
        next.status = 'error';
        next.error = result.error;
      }
    } catch (err) {
      next.status = 'error';
      next.error = err.message;
    }

    renderQueue();
  }

  setDownloadingState(false);
  processingQueue = false;
  updateQueueRing(0);

  const t = translations[currentLang];
  const completed = queue.filter(i => i.status === 'done' || i.status === 'error' || i.status === 'cancelled');
  if (completed.length > 0) {
    const errCount = queue.filter(i => i.status === 'error').length;
    const cancelledCount = queue.filter(i => i.status === 'cancelled').length;
    const doneCount = queue.filter(i => i.status === 'done').length;

    if (errCount === 0 && cancelledCount === 0) {
      showStatus(t.downloadSuccessLog, 'success');
    } else if (errCount > 0) {
      showStatus(t.queueSomeErrors, 'error');
    } else if (doneCount > 0) {
      showStatus(t.queueSomeCancelled, 'cancelled');
    }
  }
  updateQueueBadge();
}

pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    urlInput.value = text;
    urlInput.focus();
    hideError();
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(updatePreview, 100);
  } catch {}
});

urlInput.addEventListener('input', () => {
  clearTimeout(previewDebounce);
  videoPreview.classList.add('hidden');
  previewDebounce = setTimeout(updatePreview, 200);
});

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return 'Taille inconnue';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

let currentPreviewInfo = null;

async function updatePreview() {
  const url = urlInput.value.trim();
  if (!url || !isValidYouTubeUrl(url)) {
    videoPreview.classList.add('hidden');
    currentPreviewInfo = null;
    return;
  }
  
  const info = await window.api.getVideoInfo(url);
  if (info && urlInput.value.trim() === url) {
    currentPreviewInfo = info;
    previewThumbnail.src = info.thumbnail || '';
    if (info.isPlaylist) {
      previewTitle.innerHTML = `<span class="badge" style="background: var(--accent); color: var(--accent-text); padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 6px; vertical-align: middle; font-weight: bold; text-transform: uppercase;">Playlist</span>` + (info.title || 'Inconnu');
      previewDuration.textContent = `${info.videoCount} vidéos`;
      previewSize.textContent = 'Playlist';
    } else {
      previewTitle.textContent = info.title || 'Inconnu';
      previewDuration.textContent = formatDuration(info.duration);
      previewSize.textContent = formatBytes(info.size);
    }
    previewTitle.title = info.title;
    previewChannel.textContent = info.channel || '';
    videoPreview.classList.remove('hidden');
  } else if (!info) {
    currentPreviewInfo = null;
    videoPreview.classList.add('hidden');
  }
}

modeVideo.addEventListener('click', () => setMode('video'));
modeAudio.addEventListener('click', () => setMode('audio'));

function setMode(mode) {
  currentMode = mode;
  modeVideo.classList.toggle('active', mode === 'video');
  modeAudio.classList.toggle('active', mode === 'audio');
  // Sync per-video panels
  if (pvVideoOpts) pvVideoOpts.classList.toggle('hidden', mode !== 'video');
  if (pvAudioOpts) pvAudioOpts.classList.toggle('hidden', mode !== 'audio');
}

if (perVideoToggle) {
  perVideoToggle.addEventListener('click', () => {
    perVideoVisible = !perVideoVisible;
    perVideoSettings.classList.toggle('hidden', !perVideoVisible);
    perVideoToggle.classList.toggle('active', perVideoVisible);
  });
}

downloadBtn.addEventListener('click', startDownload);
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startDownload();
});

async function startDownload() {
  try {
    hideError();
    hideStatus();

    const url = urlInput.value.trim();
    const t = translations[currentLang];

    if (!url) { showError(t.emptyUrlError); return; }
    if (!isValidYouTubeUrl(url)) { showError(t.invalidUrlError); return; }

    const ready = await window.api.checkBinaries();
    if (!ready) { showError(t.notReadyError); return; }

    const id = ++queueIdCounter;
    const isPlaylist = currentPreviewInfo && currentPreviewInfo.isPlaylist;
    const playlistTitle = isPlaylist ? currentPreviewInfo.title : null;

    // Collect per-video overrides (empty string = use global default)
    const pvSettings = {
      videoQuality: pvQuality ? pvQuality.value : '',
      videoCodec: pvCodec ? pvCodec.value : '',
      videoContainer: pvContainer ? pvContainer.value : '',
      audioFormat: pvAudioFormat ? pvAudioFormat.value : '',
      audioBitrate: pvAudioBitrate ? pvAudioBitrate.value : ''
    };
    const hasPvOverride = Object.values(pvSettings).some(v => v !== '');

    const item = {
      id, url, mode: currentMode,
      title: currentPreviewInfo ? currentPreviewInfo.title : url,
      isPlaylist: isPlaylist,
      playlistTitle,
      perVideoSettings: hasPvOverride ? pvSettings : null,
      status: 'waiting',
      percent: 0, speed: '', eta: ''
    };
    queue.push(item);
    urlInput.value = '';
    currentPreviewInfo = null;
    videoPreview.classList.add('hidden');
    renderQueue();
    updateQueueBadge();

    if (!isPlaylist && item.title === url) {
      window.api.getVideoTitle(url).then(title => {
        item.title = title;
        renderQueue();
      });
    }

    processQueue();
  } catch (err) {
    showError(err.message || 'Erreur inattendue');
  }
}

cancelBtn.addEventListener('click', async () => {
  await window.api.cancelDownload();
  showStatus(translations[currentLang].downloadCancelLog, 'cancelled');
});

window.api.onProgress((data) => {
  updateQueueRing(data.percent || 0);

  const active = queue.find(i => i.status === 'active');
  if (active) {
    active.percent = data.percent;
    active.speed = data.speed || '';
    active.eta = data.eta || '';
    if (data.playlistItem) active.playlistItem = data.playlistItem;
    if (data.playlistTotal) active.playlistTotal = data.playlistTotal;
    const el = queueList.querySelector('[data-queue-id="' + active.id + '"]');
    if (el) {
      const bar = el.querySelector('.queue-item-progress-bar');
      if (bar) bar.style.width = data.percent + '%';
      const detail = el.querySelector('.queue-item-detail');
      if (detail) {
        detail.textContent = getQueueDetailText(active);
      }
    }
  }
});

window.api.onComplete(() => {});
window.api.onFailed(() => {});

window.api.onSetupProgress((data) => {
  setupOverlay.classList.remove('hidden');
  setupLabel.textContent = 'Téléchargement de ' + data.label + '...';
  setupProgressBar.style.width = data.percent + '%';
});

window.api.onSetupComplete(() => {
  setupOverlay.classList.add('hidden');
});

window.api.onSetupError((msg) => {
  setupLabel.textContent = 'Erreur : ' + msg;
  setupProgressBar.style.width = '0%';
});

// ─── Debug: log console ────────────────────────────────
const MAX_LOG_LINES = 500;

function appendLog(text, isError) {
  if (!logConsole) return;
  const placeholder = logConsole.querySelector('.log-placeholder');
  if (placeholder) placeholder.remove();

  logLines.push({ text, isError });
  if (logLines.length > MAX_LOG_LINES) logLines.shift();

  const span = document.createElement('span');
  span.className = isError ? 'log-line-err' : '';
  span.textContent = text + '\n';
  logConsole.appendChild(span);
  logConsole.scrollTop = logConsole.scrollHeight;
}

window.api.onDownloadLog((data) => {
  appendLog(data.text, data.isError);
});

window.api.onDownloadStarted((data) => {
  if (data && data.command) {
    lastCommand = data.command;
    appendLog('▶ ' + data.command, false);
  }
});

document.getElementById('clear-log')?.addEventListener('click', () => {
  if (!logConsole) return;
  logConsole.innerHTML = '<span class="log-placeholder" data-i18n="logEmpty">En attente...</span>';
  logLines = [];
});

document.getElementById('copy-last-cmd')?.addEventListener('click', () => {
  if (lastCommand) {
    navigator.clipboard.writeText(lastCommand).catch(() => {});
  }
});

document.getElementById('credits-github-btn')?.addEventListener('click', () => {
  window.api.openExternal('https://github.com/dorian-osly');
});

document.getElementById('update-binaries')?.addEventListener('click', async () => {
  const btn = document.getElementById('update-binaries');
  if (btn) btn.disabled = true;
  appendLog('Mise à jour des binaires...', false);
  const ok = await window.api.updateBinaries();
  appendLog(ok ? 'Binaires mis à jour avec succès.' : 'Échec de la mise à jour.', !ok);
  if (btn) btn.disabled = false;
  // Refresh version display
  const ver = await window.api.getYtdlpVersion();
  const vEl = document.getElementById('ytdlp-version-display');
  if (vEl) vEl.textContent = ver || '—';
});

const verboseToggle = document.getElementById('setting-verbose');
if (verboseToggle) {
  verboseToggle.addEventListener('change', (e) => {
    verboseModeEnabled = e.target.checked;
    window.api.saveSettings({ verboseMode: e.target.checked });
  });
}

openQueueBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  renderQueue();
  setQueuePanelVisibility(queuePanel.classList.contains('hidden'));
});

clearQueueBtn.addEventListener('click', () => {
  queue = queue.filter(i => i.status === 'active' || i.status === 'waiting');
  renderQueue();
});

document.addEventListener('click', (e) => {
  if (!queuePanel.classList.contains('hidden') && !queuePanel.contains(e.target) && !openQueueBtn.contains(e.target)) {
    setQueuePanelVisibility(false);
  }
});

openSettings.addEventListener('click', () => {
  setScreen('settings');
});

closeSettings.addEventListener('click', () => {
  setScreen('main');
});

changeFolder.addEventListener('click', async () => {
  const selected = await window.api.selectFolder();
  if (selected) {
    folderPath.textContent = selected;
    await window.api.saveSettings({ downloadFolder: selected });
  }
});

function showLocalizedStatus(key, type = 'success') {
  showStatus(translations[currentLang][key], type);
}

document.getElementById('import-config').addEventListener('click', async () => {
  const newConfig = await window.api.importConfig();
  if (newConfig) {
    await applySettingsToUI(newConfig);
    showLocalizedStatus('importSuccess');
  }
});

document.getElementById('export-config').addEventListener('click', async () => {
  const success = await window.api.exportConfig();
  if (success) {
    showLocalizedStatus('exportSuccess');
  }
});

document.getElementById('reset-config').addEventListener('click', async () => {
  if (confirm(translations[currentLang].resetConfirm)) {
    const defaultSettings = await window.api.resetConfig();
    await applySettingsToUI(defaultSettings);
    hideError();
    hideStatus();
  }
});

const translations = {
  fr: {
    setupTitle: "Initialisation...",
    setupLabel: "Préparation de l'environnement",
    mainTitle: "Que souhaitez-vous télécharger ?",
    linkPlaceholder: "Lien YouTube...",
    pasteBtn: "Coller",
    invalidLink: "Lien invalide",
    modeVideo: "Vidéo",
    modeAudio: "Audio",
    downloadBtn: "Télécharger",
    downloading: "Téléchargement...",
    cancelBtn: "Annuler",
    speedCalc: "Calcul...",
    settingsTitle: "Paramètres",
    backBtn: "Retour",
    emptyUrlError: "Veuillez entrer une URL.",
    invalidUrlError: "Veuillez entrer une URL YouTube valide.",
    notReadyError: "Les composants ne sont pas encore prêts. Patientez...",
    downloadCancelLog: "Téléchargement annulé.",
    downloadSuccessLog: "Téléchargement terminé !",
    openFolderLog: "Ouvrir le dossier",
    unknownError: "Erreur inconnue",
    importSuccess: "Configuration importée avec succès !",
    exportSuccess: "Configuration exportée avec succès !",
    resetConfirm: "Voulez-vous vraiment réinitialiser la configuration ?",
    queueTitle: "File d'attente",
    queueEmpty: "Aucun téléchargement en cours",
    queueActive: "En cours",
    queueWaiting: "En attente",
    queueDone: "Terminé",
    queueError: "Erreur",
    queueCancelled: "Annulé",
    queueSomeErrors: "Certains téléchargements ont échoué.",
    queueSomeCancelled: "Téléchargements terminés, certains ont été annulés.",
    queueClear: "vider",
    tabGeneral: "Général",
    tabAppearance: "Apparence",
    tabVideo: "Vidéo",
    tabAudio: "Audio",
    tabAdvanced: "Avancé",
    lblDownloadFolder: "Dossier de destination",
    descDownloadFolder: "L'emplacement où les fichiers seront sauvegardés.",
    btnModify: "Modifier",
    lblTheme: "Mode sombre",
    descTheme: "Bascule entre les thèmes clair et sombre.",
    lblCustomTheme: "Thèmes",
    descCustomTheme: "Choisissez un habillage chargé depuis le dossier assets/themes.",
    themeDefaultName: "Aucun thème",
    themeDefaultDesc: "Utilise seulement le thème clair ou sombre intégré.",
    themeEmpty: "Aucun thème détecté pour le moment.",
    themeFolderHint: "Créez un dossier dans assets/themes/NOM avec theme.css, background.png, icon.png, et éventuellement banner.png et font.ttf ou font.otf.",
    lblLanguage: "Langue",
    lblAnimations: "Animations",
    lblVideoQuality: "Qualité vidéo",
    descVideoQuality: "Si la qualité préférée n'est pas disponible, la suivante la plus proche sera sélectionnée.",
    lblVideoCodec: "Codec vidéo préféré",
    descVideoCodec: "H264 : meilleure compatibilité. max 1080p.\nAV1 : meilleure qualité/taille. supporte 4k/8k HDR.\nVP9 : supporte 4k HDR.\n\nAV1 et VP9 ne sont pas supportés partout, vous pourriez avoir besoin d'un logiciel supplémentaire pour les lire.",
    lblVideoContainer: "Conteneur vidéo",
    descVideoContainer: "Quand \"auto\" est sélectionné, le format idéal sera choisi en fonction du codec.",
    lblAudioFormat: "Format audio",
    lblAudioBitrate: "Bitrate audio",
    lblAudioTrack: "Piste audio",
    lblConfig: "Données de configuration",
    descConfig: "Importer ou exporter vos préférences au format JSON.",
    btnImport: "Importer",
    btnExport: "Exporter",
    btnReset: "Réinitialiser",
    lblDebug: "Debug",
    lblDevTools: "Outils de développement",
    descDevTools: "active la touche F12 pour ouvrir la console DevTools.",
    lblVerbose: "Mode verbose",
    descVerbose: "ajoute -v aux commandes yt-dlp pour un log détaillé.",
    lblYtdlpVersion: "version yt-dlp :",
    btnUpdateBinaries: "Mettre à jour",
    lblLogConsole: "console de log",
    descLogConsole: "sortie en temps réel de yt-dlp.",
    btnClearLog: "Vider",
    btnCopyCmd: "Copier la commande",
    logEmpty: "En attente...",
    pvQuality: "Qualité",
    pvCodec: "Codec",
    pvContainer: "Format",
    pvAudioFormat: "Format",
    pvBitrate: "Bitrate",
    pvDefault: "Par défaut",
    optAuto: "Auto",
    optDefault: "Par défaut",
    optEnabled: "Activées",
    optMinimal: "Minimales",
    optDisabled: "Désactivées",
    optBest: "Meilleur",
    tabCredits: "Crédits",
    lblDeveloper: "Développeur"
  },
  en: {
    setupTitle: "Initializing...",
    setupLabel: "Preparing environment",
    mainTitle: "What do you want to download?",
    linkPlaceholder: "YouTube link...",
    pasteBtn: "Paste",
    invalidLink: "Invalid link",
    modeVideo: "Video",
    modeAudio: "Audio",
    downloadBtn: "Download",
    downloading: "Downloading...",
    cancelBtn: "Cancel",
    speedCalc: "Calculating...",
    settingsTitle: "Settings",
    backBtn: "Back",
    emptyUrlError: "Please enter a URL.",
    invalidUrlError: "Please enter a valid YouTube URL.",
    notReadyError: "Required components are not ready yet. Please wait...",
    downloadCancelLog: "Download canceled.",
    downloadSuccessLog: "Download complete!",
    openFolderLog: "Open folder",
    unknownError: "Unknown error",
    importSuccess: "Configuration imported successfully!",
    exportSuccess: "Configuration exported successfully!",
    resetConfirm: "Are you sure you want to reset the configuration?",
    queueTitle: "Download Queue",
    queueEmpty: "No downloads in progress",
    queueActive: "Downloading",
    queueWaiting: "Waiting",
    queueDone: "Done",
    queueError: "Error",
    queueCancelled: "Canceled",
    queueSomeErrors: "Some downloads failed.",
    queueSomeCancelled: "Downloads finished, some were canceled.",
    queueClear: "clear",
    tabGeneral: "General",
    tabAppearance: "Appearance",
    tabVideo: "Video",
    tabAudio: "Audio",
    tabAdvanced: "Advanced",
    lblDownloadFolder: "Download folder",
    descDownloadFolder: "Where the downloaded files will be saved.",
    btnModify: "Modify",
    lblTheme: "Dark mode",
    descTheme: "Toggle between light and dark themes.",
    lblCustomTheme: "Themes",
    descCustomTheme: "Choose a skin loaded from the assets/themes folder.",
    themeDefaultName: "No theme",
    themeDefaultDesc: "Uses only the built-in light or dark mode.",
    themeEmpty: "No custom theme detected yet.",
    themeFolderHint: "Create a folder in assets/themes/NAME with theme.css, background.png, icon.png, and optionally banner.png plus font.ttf or font.otf.",
    lblLanguage: "Language",
    lblAnimations: "Animations",
    lblVideoQuality: "Video quality",
    descVideoQuality: "If preferred video quality isn't available, next best is picked instead.",
    lblVideoCodec: "Preferred video codec",
    descVideoCodec: "H264: best compatibility. max 1080p.\nAV1: better quality per size. supports 4k/8k HDR.\nVP9: supports 4k HDR.\n\nAV1 and VP9 are not supported everywhere, you may need an additional player or codec pack.",
    lblVideoContainer: "Video container",
    descVideoContainer: "When \"auto\" is selected, the most suitable container is chosen from the selected codec.",
    lblAudioFormat: "Audio format",
    lblAudioBitrate: "Audio bitrate",
    lblAudioTrack: "Audio track",
    lblConfig: "Configuration data",
    descConfig: "Import or export your preferences in JSON format.",
    btnImport: "Import",
    btnExport: "Export",
    btnReset: "Reset",
    lblDebug: "Debug",
    lblDevTools: "Developer tools",
    descDevTools: "enable the F12 key to open the DevTools console.",
    lblVerbose: "Verbose mode",
    descVerbose: "adds -v to yt-dlp commands for detailed logging.",
    lblYtdlpVersion: "yt-dlp version:",
    btnUpdateBinaries: "Update",
    lblLogConsole: "log console",
    descLogConsole: "real-time yt-dlp output.",
    btnClearLog: "Clear",
    btnCopyCmd: "Copy command",
    logEmpty: "Waiting...",
    pvQuality: "Quality",
    pvCodec: "Codec",
    pvContainer: "Format",
    pvAudioFormat: "Format",
    pvBitrate: "Bitrate",
    pvDefault: "Default",
    optAuto: "Auto",
    optDefault: "Default",
    optEnabled: "Enabled",
    optMinimal: "Minimal",
    optDisabled: "Disabled",
    optBest: "Best",
    tabCredits: "Credits",
    lblDeveloper: "Developer"
  }
};

let currentLang = 'fr';

function applyLanguage(langSetting) {
  let lang = langSetting;
  if (lang === 'auto') {
    lang = navigator.language.startsWith('fr') ? 'fr' : 'en';
  }
  if (!translations[lang]) lang = 'en';
  currentLang = lang;
  const t = translations[lang];

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.innerHTML = t[key].replace(/\n/g, '<br>');
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (t[key]) el.setAttribute('title', t[key]);
  });

  const urlInp = document.getElementById('url-input');
  if (urlInp) urlInp.setAttribute('placeholder', t.linkPlaceholder);

  renderThemeCards();
}

document.querySelectorAll('.modern-segmented').forEach(group => {
  const groupId = group.id;
  if (!groupId) return;
  const segments = group.querySelectorAll('.modern-segment');
  const configKey = getSettingKey(groupId);

  segments.forEach(btn => {
    btn.addEventListener('click', async () => {
      segments.forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.getAttribute('data-val');
      await window.api.saveSettings({ [configKey]: val });
      if (configKey === 'animations') applyAnimations(val);
      if (configKey === 'language') applyLanguage(val);
    });
  });
});

function updateSegmentedControl(id, value) {
  const group = document.getElementById(id);
  if (!group) return;
  group.querySelectorAll('.modern-segment').forEach(s => {
    s.classList.toggle('active', s.getAttribute('data-val') === value);
  });
}

document.querySelectorAll('.sidebar-link').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const tab = link.getAttribute('data-tab');
    document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('pane-' + tab).classList.add('active');
  });
});

async function applySettingsToUI(settings) {
  folderPath.textContent = settings.downloadFolder || '~/Téléchargements';
  preferredThemeMode = settings.theme || 'dark';
  syncThemeMode();
  applyAnimations(settings.animations || 'enabled');
  applyLanguage(settings.language || 'auto');

  SETTINGS_GROUP_IDS.forEach(id => {
    const key = getSettingKey(id);
    if (settings[key] !== undefined) updateSegmentedControl(id, settings[key]);
  });
  await refreshThemes(settings.customTheme || 'default');

  const devToolsToggle = document.getElementById('setting-dev-tools');
  if (devToolsToggle) devToolsToggle.checked = settings.devTools || false;

  if (verboseToggle) verboseToggle.checked = settings.verboseMode || false;
  verboseModeEnabled = settings.verboseMode || false;

  // Fetch and display yt-dlp version
  window.api.getYtdlpVersion().then((ver) => {
    const vEl = document.getElementById('ytdlp-version-display');
    if (vEl) vEl.textContent = ver || '—';
  });
}

const themeToggle = document.getElementById('setting-theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('change', (e) => {
    setTheme(e.target.checked ? 'dark' : 'light');
  });
}

const devToolsToggle = document.getElementById('setting-dev-tools');
if (devToolsToggle) {
  devToolsToggle.addEventListener('change', (e) => {
    window.api.saveSettings({ devTools: e.target.checked });
  });
}

function setTheme(theme, { persist = true } = {}) {
  preferredThemeMode = theme;
  syncThemeMode({ persist });
}

function applyAnimations(animSetting) {
  if (animSetting === 'disabled') {
    document.documentElement.style.setProperty('--transition', 'none');
    document.documentElement.style.setProperty('--slide-transition', 'none');
  } else if (animSetting === 'minimal') {
    document.documentElement.style.setProperty('--transition', '0.1s ease');
    document.documentElement.style.setProperty('--slide-transition', '0.2s ease');
  } else {
    document.documentElement.style.setProperty('--transition', '0.25s cubic-bezier(0.25, 0.1, 0.25, 1)');
    document.documentElement.style.setProperty('--slide-transition', '0.4s cubic-bezier(0.25, 1, 0.5, 1)');
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const settings = await window.api.getSettings();
  await applySettingsToUI(settings);
});