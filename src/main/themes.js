const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { themesDir } = require('./paths');

function createThemeAssetPath(themeId, fileName) {
  return `../assets/themes/${encodeURIComponent(themeId)}/${encodeURIComponent(fileName)}`;
}

async function getThemeFontDescriptor(themeId, themePath) {
  const fontCandidates = [
    { fileName: 'font.ttf', format: 'truetype' },
    { fileName: 'font.otf', format: 'opentype' }
  ];

  for (const candidate of fontCandidates) {
    try {
      await fsp.access(path.join(themePath, candidate.fileName));
      return {
        fontPath: createThemeAssetPath(themeId, candidate.fileName),
        fontFormat: candidate.format
      };
    } catch {}
  }

  return { fontPath: null, fontFormat: null };
}

async function getThemeMetadata(themePath) {
  const metaPath = path.join(themePath, 'theme.json');
  try {
    const content = await fsp.readFile(metaPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function formatThemeLabel(themeId) {
  return themeId
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function listThemes() {
  try {
    let entries;
    try {
      entries = await fsp.readdir(themesDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const results = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const themeId = entry.name;
      const themePath = path.join(themesDir, themeId);
      const cssFileName = 'theme.css';
      const backgroundFileName = 'background.png';
      const iconFileName = 'icon.png';
      const bannerFileName = 'banner.png';

      try {
        await fsp.access(path.join(themePath, cssFileName));
      } catch {
        continue;
      }

      let hasBackground = false;
      let hasIcon = false;
      let hasBanner = false;

      try { await fsp.access(path.join(themePath, backgroundFileName)); hasBackground = true; } catch {}
      try { await fsp.access(path.join(themePath, iconFileName)); hasIcon = true; } catch {}
      try { await fsp.access(path.join(themePath, bannerFileName)); hasBanner = true; } catch {}

      const { fontPath, fontFormat } = await getThemeFontDescriptor(themeId, themePath);
      const meta = await getThemeMetadata(themePath);

      results.push({
        id: themeId,
        label: formatThemeLabel(themeId),
        stylesheetPath: createThemeAssetPath(themeId, cssFileName),
        backgroundPath: hasBackground ? createThemeAssetPath(themeId, backgroundFileName) : null,
        iconPath: hasIcon ? createThemeAssetPath(themeId, iconFileName) : null,
        bannerPath: hasBanner ? createThemeAssetPath(themeId, bannerFileName) : null,
        fontPath,
        fontFormat,
        customPhrases: Array.isArray(meta.customPhrases) ? meta.customPhrases : meta.customPhrase ? [meta.customPhrase] : null
      });
    }

    return results.sort((left, right) => left.label.localeCompare(right.label, 'fr', { sensitivity: 'base' }));
  } catch {
    return [];
  }
}

module.exports = { listThemes };
