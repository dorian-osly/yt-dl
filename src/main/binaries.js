const fs = require('fs');
const fsp = fs.promises;
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
const path = require('path');
const paths = require('./paths');

async function ensureBinDir() {
  await fsp.mkdir(paths.getBinDir(), { recursive: true });
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
      await ensureBinDir();
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

function escapePsString(str) {
  return str.replace(/'/g, "''").replace(/\0/g, '');
}

function spawnPs(script) {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell', ['-NoProfile', '-Command', script], { stdio: 'pipe' });
    ps.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`PowerShell extraction failed (code ${code})`));
    });
    ps.on('error', reject);
  });
}

async function extractSingleExeFromZip(zipPath, exeName) {
  if (paths.isWin) {
    const binDir = paths.getBinDir();
    const script = `
      $zip = '${escapePsString(zipPath)}';
      $dest = '${escapePsString(binDir)}';
      Add-Type -AssemblyName System.IO.Compression.FileSystem;
      $archive = [System.IO.Compression.ZipFile]::OpenRead($zip);
      foreach ($entry in $archive.Entries) {
        if ($entry.Name -eq '${exeName.replace(/'/g, "''")}') {
          $stream = $entry.Open();
          $fileStream = [System.IO.File]::Create("$dest\\${exeName}");
          $stream.CopyTo($fileStream);
          $fileStream.Close();
          $stream.Close();
          break;
        }
      }
      $archive.Dispose();
    `;
    await spawnPs(script);
  } else {
    const binDir = paths.getBinDir();
    const { execFile } = require('child_process');
    const util = require('util');
    const execFileAsync = util.promisify(execFile);
    await execFileAsync('unzip', ['-o', '-j', zipPath, `*/${exeName}`, '-d', binDir]);
    const extracted = path.join(binDir, exeName);
    if (fs.existsSync(extracted)) {
      await fsp.chmod(extracted, 0o755);
    }
  }
}

async function extractFfmpegFromZip(zipPath) {
  const binDir = paths.getBinDir();
  if (paths.isWin) {
    const script = `
      $zip = '${escapePsString(zipPath)}';
      $dest = '${escapePsString(binDir)}';
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
    `;
    await spawnPs(script);
  } else {
    const { execFile } = require('child_process');
    const util = require('util');
    const execFileAsync = util.promisify(execFile);
    if (zipPath.endsWith('.tar.xz')) {
      const tmpDir = path.join(binDir, 'ffmpeg-tmp');
      await fsp.mkdir(tmpDir, { recursive: true });
      await execFileAsync('tar', ['-xf', zipPath, '-C', tmpDir]);
      const walkDir = async (dir) => {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.name === 'ffmpeg' || entry.name === 'ffprobe') {
            const dst = path.join(binDir, entry.name);
            await fsp.copyFile(fullPath, dst);
            await fsp.chmod(dst, 0o755);
          }
        }
      };
      await walkDir(tmpDir);
      await fsp.rm(tmpDir, { recursive: true, force: true });
    } else {
      await execFileAsync('unzip', ['-o', '-j', zipPath, '*/ffmpeg', '*/ffprobe', '-d', binDir]);
      for (const name of ['ffmpeg', 'ffprobe']) {
        const p = path.join(binDir, name);
        if (fs.existsSync(p)) await fsp.chmod(p, 0o755);
      }
    }
  }
}

function getBinarySources() {
  const ytDlpPath = paths.getYtDlpPath();
  const ffmpegPath = paths.getFfmpegPath();
  const ffmpegZipPath = paths.getFfmpegZipPath();
  const denoPath = paths.getDenoPath();
  const denoZipPath = paths.getDenoZipPath();

  return [
    {
      existsAt: ytDlpPath,
      downloadTo: ytDlpPath,
      label: 'yt-dlp',
      url: paths.isWin
        ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
        : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'
    },
    {
      existsAt: ffmpegPath,
      downloadTo: ffmpegZipPath,
      label: 'ffmpeg',
      url: paths.isWin
        ? 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
        : 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz'
    },
    {
      existsAt: denoPath,
      downloadTo: denoZipPath,
      label: 'deno',
      url: paths.isWin
        ? 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip'
        : paths.isMac
          ? 'https://github.com/denoland/deno/releases/latest/download/deno-aarch64-apple-darwin.zip'
          : 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip'
    }
  ];
}

async function ensureBinaries(win) {
  await ensureBinDir();
  const binarySources = getBinarySources();
  const needed = [];
  for (const item of binarySources) {
    try {
      await fsp.access(item.existsAt);
    } catch {
      needed.push(item);
    }
  }

  if (needed.length === 0) return true;

  for (const item of needed) {
    if (win) win.webContents.send('setup-progress', { label: item.label, percent: '0' });
    await downloadFile(item.url, item.downloadTo, win, item.label);
  }

  const ffmpegPath = paths.getFfmpegPath();
  const ffmpegZipPath = paths.getFfmpegZipPath();
  let ffmpegExtracted = false;
  try { await fsp.access(ffmpegPath); ffmpegExtracted = true; } catch {}
  if (!ffmpegExtracted) {
    try {
      await fsp.access(ffmpegZipPath);
      if (win) win.webContents.send('setup-progress', { label: 'ffmpeg', percent: '99' });
      await extractFfmpegFromZip(ffmpegZipPath);
      try { await fsp.unlink(ffmpegZipPath); } catch {}
    } catch {}
  }

  const denoPath = paths.getDenoPath();
  const denoZipPath = paths.getDenoZipPath();
  let denoExtracted = false;
  try { await fsp.access(denoPath); denoExtracted = true; } catch {}
  if (!denoExtracted) {
    try {
      await fsp.access(denoZipPath);
      if (win) win.webContents.send('setup-progress', { label: 'deno', percent: '99' });
      await extractSingleExeFromZip(denoZipPath, paths.isWin ? 'deno.exe' : 'deno');
      try { await fsp.unlink(denoZipPath); } catch {}
    } catch {}
  }

  if (!paths.isWin) {
    const ytDlpPath = paths.getYtDlpPath();
    try { await fsp.chmod(ytDlpPath, 0o755); } catch {}
  }

  if (win) win.webContents.send('setup-complete');
  return true;
}

async function deleteBinaries() {
  const toDelete = [
    paths.getYtDlpPath(),
    paths.getFfmpegPath(),
    paths.getFfmpegZipPath(),
    paths.getDenoPath(),
    paths.getDenoZipPath()
  ];
  for (const f of toDelete) {
    try { await fsp.unlink(f); } catch {}
  }
}

module.exports = {
  ensureBinaries,
  deleteBinaries,
  ensureBinDir
};
