import { app } from 'electron';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { AppUpdateInfo, UpdateCheckResult } from '../src/types';

/**
 * Parses and compares two semver strings (e.g. "1.0.2" vs "1.0.1").
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, and 0 if equal.
 */
export function compareSemver(v1: string, v2: string): number {
  const clean = (v: string) => v.replace(/^v/i, '').trim();
  const parts1 = clean(v1).split('.').map((n) => parseInt(n, 10) || 0);
  const parts2 = clean(v2).split('.').map((n) => parseInt(n, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Checks the LAN update server for a newer version by reading version.json
 */
export async function checkForUpdates(serverUrl: string): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion();

  if (!serverUrl || !serverUrl.trim()) {
    return {
      hasUpdate: false,
      currentVersion,
      error: 'Update server URL is not configured.',
    };
  }

  let cleanUrl = serverUrl.trim();
  if (cleanUrl.endsWith('/')) {
    cleanUrl = cleanUrl.slice(0, -1);
  }

  const manifestUrl = cleanUrl.endsWith('.json') ? cleanUrl : `${cleanUrl}/version.json`;

  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(manifestUrl);
      const transport = parsedUrl.protocol === 'https:' ? https : http;

      const req = transport.get(
        parsedUrl,
        {
          timeout: 4500,
          headers: {
            'User-Agent': `AI-Local-Translator/${currentVersion}`,
          },
        },
        (res) => {
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            resolve({
              hasUpdate: false,
              currentVersion,
              error: `Server returned HTTP ${res.statusCode} while checking updates.`,
            });
            return;
          }

          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const info: AppUpdateInfo = JSON.parse(data);
              if (!info.version) {
                resolve({
                  hasUpdate: false,
                  currentVersion,
                  error: 'Invalid version manifest on update server.',
                });
                return;
              }

              // Automatically pick the right binary based on running mode (Portable vs Installer)
              const isPortable = !!process.env.PORTABLE_EXECUTABLE_FILE;
              let selectedFile = info.downloadUrl;
              if (isPortable && info.portableUrl) {
                selectedFile = info.portableUrl;
              } else if (!isPortable && info.installerUrl) {
                selectedFile = info.installerUrl;
              }

              // Resolve relative download URL if needed
              let resolvedDownloadUrl = selectedFile;
              if (resolvedDownloadUrl && !resolvedDownloadUrl.startsWith('http://') && !resolvedDownloadUrl.startsWith('https://')) {
                resolvedDownloadUrl = `${cleanUrl}/${resolvedDownloadUrl.replace(/^\//, '')}`;
              }
              info.downloadUrl = resolvedDownloadUrl;

              const hasUpdate = compareSemver(info.version, currentVersion) > 0;
              resolve({
                hasUpdate,
                currentVersion,
                updateInfo: info,
              });
            } catch (err: any) {
              resolve({
                hasUpdate: false,
                currentVersion,
                error: `Failed to parse version.json: ${err.message}`,
              });
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve({
          hasUpdate: false,
          currentVersion,
          error: 'Connection to LAN update server timed out.',
        });
      });

      req.on('error', (err) => {
        resolve({
          hasUpdate: false,
          currentVersion,
          error: `Could not reach LAN update server (${err.message})`,
        });
      });
    } catch (e: any) {
      resolve({
        hasUpdate: false,
        currentVersion,
        error: `Invalid server URL: ${e.message}`,
      });
    }
  });
}

/**
 * Downloads the update executable from the LAN server with progress tracking.
 */
export async function downloadUpdate(
  downloadUrl: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(downloadUrl);
      const transport = parsedUrl.protocol === 'https:' ? https : http;

      const rawFileName = path.basename(parsedUrl.pathname) || `AI_Local_Translator_Update_${Date.now()}.exe`;
      const fileName = decodeURIComponent(rawFileName);
      const tempPath = path.join(app.getPath('temp'), fileName);
      const fileStream = fs.createWriteStream(tempPath);

      const req = transport.get(
        parsedUrl,
        {
          headers: {
            'User-Agent': 'AI-Local-Translator-Updater',
          },
        },
        (res) => {
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            fileStream.close();
            try { fs.unlinkSync(tempPath); } catch (e) {}
            reject(new Error(`Download failed with status ${res.statusCode}`));
            return;
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let receivedBytes = 0;

          res.on('data', (chunk) => {
            receivedBytes += chunk.length;
            if (totalBytes > 0 && onProgress) {
              const pct = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
              onProgress(pct);
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => resolve(tempPath));
          });
        }
      );

      req.on('error', (err) => {
        fileStream.close();
        try { fs.unlinkSync(tempPath); } catch (e) {}
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Applies the update and restarts the application:
 * - If running as Portable: Uses a hidden detached PowerShell script to wait for the old process
 *   to release file locks, overwrites the portable exe, and relaunches it.
 * - If running as Installer: Launches the installer in a hidden/background helper and quits.
 */
export function applyUpdateAndRestart(downloadedFilePath: string): void {
  const tempDir = app.getPath('temp');
  const portableExe = process.env.PORTABLE_EXECUTABLE_FILE;

  if (portableExe && fs.existsSync(portableExe)) {
    // Portable executable update
    const tempPs1 = path.join(tempDir, `apply_update_${Date.now()}.ps1`);
    const escapedSource = downloadedFilePath.replace(/'/g, "''");
    const escapedTarget = portableExe.replace(/'/g, "''");

    const scriptContent = `Start-Sleep -Seconds 1
$source = '${escapedSource}'
$target = '${escapedTarget}'
$success = $false

Unblock-File -Path $source -ErrorAction SilentlyContinue

for ($i = 0; $i -lt 30; $i++) {
    try {
        Copy-Item -Path $source -Destination $target -Force -ErrorAction Stop
        $success = $true
        break
    } catch {
        Start-Sleep -Milliseconds 500
    }
}

if ($success) {
    Unblock-File -Path $target -ErrorAction SilentlyContinue
    Start-Process -FilePath $target -WorkingDirectory (Split-Path -Parent $target)
}
Remove-Item -Path $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue
`;

    fs.writeFileSync(tempPs1, scriptContent, 'utf-8');

    spawn('powershell.exe', [
      '-WindowStyle', 'Hidden',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', tempPs1,
    ], {
      cwd: tempDir,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();

    app.quit();
    return;
  }

  // Installer update (or normal exe)
  const tempPs1 = path.join(tempDir, `apply_installer_${Date.now()}.ps1`);
  const escapedInstaller = downloadedFilePath.replace(/'/g, "''");

  const scriptContent = `Start-Sleep -Seconds 2
$installer = '${escapedInstaller}'
Unblock-File -Path $installer -ErrorAction SilentlyContinue
Start-Process -FilePath $installer -WorkingDirectory '${tempDir.replace(/'/g, "''")}'
Remove-Item -Path $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue
`;

  fs.writeFileSync(tempPs1, scriptContent, 'utf-8');

  spawn('powershell.exe', [
    '-WindowStyle', 'Hidden',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', tempPs1,
  ], {
    cwd: tempDir,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();

  app.quit();
}
