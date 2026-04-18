# yt-dl
A simple YouTube Downloader app based on Electron.

# Changelog

All notable changes to **yt-dl** will be documented in this file.

---

## [1.2.2] - 2026-04-18

### Added

- **Download queue** system with sequential processing
- Floating queue button with circular SVG progress ring
- Counter badge on the queue button
- Queue dropdown panel with per-item details (progress, speed, ETA, playlist item number)
- Individual download cancellation from the queue
- "Clear" button to remove completed/cancelled items from the queue
- Main progress bar below the download controls
- **Per-video settings**: quality, codec, video container, audio format and bitrate overridable per download without changing global settings
- Toggle button to show/hide per-video settings
- **Video preview** with thumbnail, title, channel, duration and estimated size
- Automatic playlist detection in preview (playlist badge, video count)
- URL drag & drop into the input field
- Global paste detection (detects a YouTube URL pasted outside the input field)
- **Real-time log console** in advanced settings (yt-dlp output)
- "Copy command" button to copy the exact yt-dlp command
- "Clear" button to empty the log console
- **Download history** with date, mode (video/audio), title, folder
- "Open folder" button in history
- "Clear history" button
- 200-entry limit on history
- **System notification** (Electron Notification) on download completion
- **SponsorBlock**: option to mark sponsored segments in the video progress bar
- **Subtitles**: automatic download with language selection (en, fr, de, es, ja) and SRT conversion
- **Audio track / dubbing**: audio track language selection (default, French, English)
- **Thumbnail embedding** in audio files (embed thumbnail + JPG conversion)
- **Verbose mode**: adds `-v` to yt-dlp commands for detailed logging
- **Developer tools** (DevTools) toggleable via settings (F12)
- **GPU acceleration disable** with restart-required warning
- **Binary updates** (yt-dlp, ffmpeg, deno) from settings
- Installed yt-dlp version display
- **Config import / export** in JSON format
- **Config reset** to default values
- **Custom theme system** loaded from `assets/themes/` with:
  - CSS stylesheet (`theme.css`)
  - Background image (`background.png`)
  - Custom icon (`icon.png`)
  - Banner (`banner.png`)
  - Custom font (`font.ttf` or `font.otf`)
  - Random custom phrases (`theme.json` → `customPhrases`)
  - Visual theme selection grid with cards (preview, icon, banner)
- Built-in themes:
  - **Deltarune** (themed phrases, custom font, background and icon)
  - **Easter Egg** (custom phrase, background and icon)
- **Dark / light mode** toggle (automatically disabled when a custom theme is active)
- **i18n**: bilingual French / English interface with automatic system language detection
- **Animations** setting (enabled, minimal, disabled) with customizable CSS transitions
- **Setup screen** with progress bar on first binary download (yt-dlp, ffmpeg, deno)
- **Binary management**: automatic download and extraction (ZIP on Windows, tar.xz on Linux) of yt-dlp, ffmpeg and deno
- Cross-platform binary path support (Windows exe, Linux/Mac binary)
- ZIP extraction via PowerShell on Windows, `unzip`/`tar` on other platforms
- **Build**: Electron packaging with electron-builder (NSIS installer + portable .exe) for Windows
- ESLint config with separate rules for main (Node.js) and renderer (browser)
- Prettier for code formatting
- GPLv3 license

### Technical

- Electron architecture with **context isolation** and secure **preload script**
- IPC communication between main and renderer via `contextBridge`
- YouTube URL validation (watch, shorts, embed, v, playlist, youtu.be, music.youtube.com)
- Dynamic yt-dlp argument building based on mode, codec, quality, container, audio track
- Video output format: `bestvideo[codec][height]+bestaudio[language]` with fallbacks
- Audio output format: extraction + conversion + custom bitrate
- Download artifact cleanup on cancellation (.part, .ytdl files)
- Forced process termination via `taskkill /T /F` on Windows, `SIGKILL` on other OSes
- Real-time yt-dlp output parsing (progress %, size, speed, ETA, playlist item)
- Playlist folder name sanitization (forbidden characters, max length 150)
- Content Security Policy (CSP) in HTML
- Custom CSS variables for themes (dark/light + custom)
- Monospace design (Space Mono) with minimalist black and white palette
- Tab-based settings navigation (General, Appearance, Video, Audio, Advanced, History)
- Animated transition between main screen and settings screen

---

## [1.2.1] - 2026-04-XX

### Added

- NSIS installer and portable build for Windows (v1.2.1)

---

## [1.0.0] - Initial Release

### Added

- Basic Electron application for YouTube downloading
- URL input field with "Paste" button
- Video / audio mode toggle
- Download and cancel buttons
- Download folder selection
- Automatic binary download (yt-dlp, ffmpeg)
- Default dark theme
- Basic settings (video quality, codec, audio format, bitrate)
- Settings screen with navigation
