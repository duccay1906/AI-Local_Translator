import { app, BrowserWindow, globalShortcut, ipcMain, screen, clipboard, Tray, Menu, nativeImage, desktopCapturer, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { streamTranslation, fetchAvailableModels, translateBlocks } from './lmstudio';
import { extractTextFromImage, extractTextAndBlocksFromImage, terminateOcrWorker } from './ocr';
import { checkForUpdates, downloadUpdate, applyUpdateAndRestart } from './updater';
import { AppSettings, TranslationHistoryItem, SnipSelectionResult } from '../src/types';

let popupWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let snipWindow: BrowserWindow | null = null;
let ocrDialogWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentAbortController: { abort: () => void } | null = null;
let lastCapturedScreen: Electron.NativeImage | null = null;

const TRAY_ICON_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAIhSURBVHgB7VdNSgMxEE5CQRBEFAURF0IXLlzozkV6A0HQrVt3XkBw57gRF64giLhzEUEEwZ3ozGfSznTa3el0MplJvvC9N/OStvPhfV+j0aitpuksmqYLWJaV9i1d/2/v/RFFUSNJkiBv3uLzeDxe961f7oF4f3ccZ9cwt2mapq0bHMe5H9f2913A8zzj1fO8T3XnOI42DEPtdzW1Wq1aqvPj+n0+n7e8yN7vd9s/Dk3TNHWapla92u/3q+12e1o0mUyo67pWr9er1WpllUql3+/1eu3b7bZbLpcuTdNM4zj2eL4v2vUie55nfV9b12q1qlQq2Xg8tmazuS63222r1Wp6vV623W51s9nYu9f3/a+tVutv6z8N/C+aTqdH2/ZyuVRv1+t1bTQalTqdTqVer/9N90d/v98fyul00qXxeFwq/qJ6vV6rUqm0qFar/crL5VIJISLqdruVGo1GpWq1+qu7TqdTy3U9r1Yr+z/0arWyaDTq1Wq1tFqt/uo8l0slhGihNpvNWvb9ft+Gw+HS5w73+32H8/lcs+Vyaf1+n3ndzGazaavVqq3X66W73e6w+w3/6/5v96vxeGy3281m8/ldj8ej9fs9m80d8z8fVqvV0s1mwzybz2d5f/Rer2dr3jFf9ffo3/t1/6u+t9tNlcvl8p89P/F8Pi+t12ur67odf1mSJD6K12p+/wT8e8Q/y89X4y911EwAAAAASUVORK5CYII=';

function getAppIcon() {
  const possiblePaths = [
    path.join(__dirname, 'icon@4x.png'),
    path.join(__dirname, 'icon.png'),
    path.join(__dirname, 'icon.ico'),
    path.join(__dirname, '../build/icon.png'),
    path.join(app.getAppPath(), 'electron/icon@4x.png'),
    path.join(app.getAppPath(), 'build/icon.png'),
    path.join(process.cwd(), 'build/icon.png'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return nativeImage.createFromPath(p);
    }
  }
  return nativeImage.createFromDataURL(TRAY_ICON_PNG);
}

const appIcon = getAppIcon();

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 360,
    height: 220,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    skipTaskbar: false,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    splashWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#splash`);
  } else {
    splashWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'splash' });
  }
}

// Prevent Chromium GPU cache permission locks on Windows
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.setPath('userData', path.join(app.getPath('appData'), 'ai-local-translator-data'));

// Settings store path
const userDataPath = app.getPath('userData');
const settingsFilePath = path.join(userDataPath, 'app_settings.json');
const historyFilePath = path.join(userDataPath, 'translation_history.json');

function ensureUserDataDir() {
  try {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to create user data dir:', err);
  }
}

const defaultSettings: AppSettings = {
  lmStudioUrl: 'http://192.168.1.6:1234',
  modelName: '',
  targetLanguage: 'Vietnamese',
  systemPrompt: 'You are a professional translator. Translate the given text into {targetLanguage}. Output ONLY the translated text without extra explanation.',
  triggerMode: 'hotkey',
  hotkey: 'F8',
  ocrHotkey: 'F9',
  ocrLanguage: 'auto',
  reasoningEffort: 'none',
  autoStartWithWindows: true,
  autoCopySelection: true,
  theme: 'dark',
  opacity: 0.92,
  updateServerUrl: 'http://192.168.1.12:8080/updates',
  autoCheckUpdate: true,
};

function loadSettings(): AppSettings {
  try {
    ensureUserDataDir();
    if (fs.existsSync(settingsFilePath)) {
      const data = fs.readFileSync(settingsFilePath, 'utf-8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
  return defaultSettings;
}

function saveSettingsToDisk(settings: AppSettings): boolean {
  try {
    ensureUserDataDir();
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save settings:', err);
    return false;
  }
}

function loadHistory(): TranslationHistoryItem[] {
  try {
    ensureUserDataDir();
    if (fs.existsSync(historyFilePath)) {
      const data = fs.readFileSync(historyFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  }
  return [];
}

function saveHistoryToDisk(history: TranslationHistoryItem[]): boolean {
  try {
    ensureUserDataDir();
    fs.writeFileSync(historyFilePath, JSON.stringify(history.slice(0, 100), null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save history:', err);
    return false;
  }
}

let activeSettings = loadSettings();

function applyAutoStartSetting(enabled: boolean) {
  if (!app.isPackaged) return;

  const targetExe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: targetExe,
      args: ['--hidden'],
    });

    const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
    const regName = 'AILocalTranslator';
    if (enabled) {
      exec(`reg add "${regKey}" /v "${regName}" /t REG_SZ /d "\\"${targetExe}\\" --hidden" /f`);
    } else {
      exec(`reg delete "${regKey}" /v "${regName}" /f`);
    }
  } catch (err) {
    console.error('Failed to configure Windows auto-start:', err);
  }
}

function createPopupWindow() {
  popupWindow = new BrowserWindow({
    width: 440,
    height: 320,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    popupWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#popup`);
  } else {
    popupWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'popup' });
  }

  popupWindow.webContents.on('before-input-event', (_, input) => {
    const key = (input.key || '').toLowerCase();
    const code = (input.code || '').toLowerCase();
    if (key === 'escape' || key === 'esc' || code === 'escape') {
      hidePopupWindow();
    }
  });

  popupWindow.on('blur', () => {
    if (popupWindow && !popupWindow.isDestroyed() && !(popupWindow as any).isPinned) {
      hidePopupWindow();
    }
  });
  popupWindow.on('hide', () => {
    try {
      if (!snipWindow || !snipWindow.isVisible()) {
        globalShortcut.unregister('Escape');
      }
    } catch (e) {}
  });
}

function createSnipWindow() {
  snipWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    type: 'toolbar',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    fullscreenable: true,
    hasShadow: false,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Exclude snip overlay from desktopCapturer so it never captures its own dark tint
  snipWindow.setContentProtection(true);

  const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    snipWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#snip`);
  } else {
    snipWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'snip' });
  }

  snipWindow.webContents.on('before-input-event', (_, input) => {
    const key = (input.key || '').toLowerCase();
    const code = (input.code || '').toLowerCase();
    if (key === 'escape' || key === 'esc' || code === 'escape') {
      hideSnipWindow();
    }
  });

  snipWindow.on('closed', () => {
    snipWindow = null;
  });
}

function hideSnipWindow() {
  if (snipWindow && !snipWindow.isDestroyed()) {
    snipWindow.setOpacity(0);
    snipWindow.webContents.send('snip-reset');
    snipWindow.hide();
    try {
      if (!popupWindow || !popupWindow.isVisible()) {
        globalShortcut.unregister('Escape');
      }
    } catch (e) {}
  }
}

function createOcrDialogWindow(): BrowserWindow {
  if (ocrDialogWindow && !ocrDialogWindow.isDestroyed()) {
    return ocrDialogWindow;
  }

  ocrDialogWindow = new BrowserWindow({
    width: 820,
    height: 560,
    minWidth: 800,
    minHeight: 480,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    ocrDialogWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#ocr`);
  } else {
    ocrDialogWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'ocr' });
  }

  ocrDialogWindow.webContents.on('before-input-event', (_, input) => {
    const key = (input.key || '').toLowerCase();
    const code = (input.code || '').toLowerCase();
    if (key === 'escape' || key === 'esc' || code === 'escape') {
      hideOcrDialogWindow();
    }
  });

  ocrDialogWindow.on('blur', () => {
    if (ocrDialogWindow && !ocrDialogWindow.isDestroyed() && !(ocrDialogWindow as any).isPinned) {
      hideOcrDialogWindow();
    }
  });

  ocrDialogWindow.on('closed', () => {
    ocrDialogWindow = null;
  });

  return ocrDialogWindow;
}

function hideOcrDialogWindow() {
  if (ocrDialogWindow && !ocrDialogWindow.isDestroyed()) {
    ocrDialogWindow.hide();
  }
}

function createSettingsWindow(initialTab?: string) {
  const hash = initialTab ? `settings?tab=${initialTab}` : 'settings';
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.focus();
    if (initialTab) {
      settingsWindow.webContents.send('switch-settings-tab', initialTab);
    }
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 780,
    height: 620,
    show: false,
    title: 'AI Local Translator - Settings',
    autoHideMenuBar: true,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#${hash}`);
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash });
  }

  settingsWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      settingsWindow?.show();
    }, 400);
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createTray() {
  tray = new Tray(appIcon);
  tray.setToolTip('AI Local Translator - Click to open Settings');

  // Single click or double click to open Settings immediately
  tray.on('click', () => {
    createSettingsWindow();
  });
  tray.on('double-click', () => {
    createSettingsWindow();
  });

  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    { label: '✨ AI Local Translator', enabled: false },
    { type: 'separator' },
    {
      label: '⚙️ Open Settings (Cài đặt)',
      click: () => createSettingsWindow(),
    },
    {
      label: '🔄 Check for Updates...',
      click: () => createSettingsWindow('updates'),
    },
    {
      label: '📌 Translate Selected Text',
      click: () => triggerTranslationFlow(),
    },
    {
      label: '📷 Screen OCR Translate (Dịch vùng ảnh)',
      click: () => triggerOcrSnipFlow(),
    },
    { type: 'separator' },
    {
      label: `🌐 Target Language: ${activeSettings.targetLanguage}`,
      enabled: false,
    },
    {
      label: `⌨️ Text Shortcut: ${activeSettings.hotkey || 'F8'}`,
      enabled: false,
    },
    {
      label: `📷 OCR Shortcut: ${activeSettings.ocrHotkey || 'F9'}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '🚀 Start with Windows (Khởi động cùng Win)',
      type: 'checkbox',
      checked: activeSettings.autoStartWithWindows ?? true,
      click: (menuItem) => {
        activeSettings.autoStartWithWindows = menuItem.checked;
        saveSettingsToDisk(activeSettings);
        applyAutoStartSetting(menuItem.checked);
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: '❌ Exit App',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

const vbsPath = path.join(app.getPath('userData'), 'send_copy.vbs');

function initVbsHelper() {
  try {
    // WScript.Sleep 220 waits for user to physically release Alt/Shift modifier keys before sending ^c
    const vbsContent = 'WScript.Sleep 220\r\nSet WshShell = WScript.CreateObject("WScript.Shell")\r\nWshShell.SendKeys "^c"';
    fs.writeFileSync(vbsPath, vbsContent, 'utf-8');
  } catch (err) {
    console.error('Failed to write VBS helper:', err);
  }
}

async function captureSelectedText(): Promise<string> {
  return new Promise((resolve) => {
    exec(`cscript //nologo "${vbsPath}"`, () => {
      setTimeout(() => {
        const capturedText = clipboard.readText();
        resolve(capturedText ? capturedText.trim() : '');
      }, 100);
    });
  });
}

function hidePopupWindow() {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.hide();
    try {
      if (!snipWindow || !snipWindow.isVisible()) {
        globalShortcut.unregister('Escape');
      }
    } catch (e) {}
  }
}

function registerEscapeShortcut() {
  try {
    globalShortcut.unregister('Escape');
  } catch (e) {}

  try {
    globalShortcut.register('Escape', () => {
      if (snipWindow && !snipWindow.isDestroyed() && snipWindow.isVisible()) {
        hideSnipWindow();
        return;
      }
      hidePopupWindow();
    });
  } catch (e) {
    console.warn('Failed to register global Escape:', e);
  }
}

function showPopupWindowWithFocus() {
  if (!popupWindow || popupWindow.isDestroyed()) return;

  app.focus({ steal: true });
  popupWindow.show();
  popupWindow.setAlwaysOnTop(true, 'pop-up-menu');
  popupWindow.focus();

  setTimeout(() => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      if (!(popupWindow as any).isPinned) {
        popupWindow.setAlwaysOnTop(true, 'normal');
      }
      popupWindow.focus();
    }
  }, 50);

  registerEscapeShortcut();
}

function positionPopupAtPoint(pointX: number, pointY: number) {
  const display = screen.getDisplayNearestPoint({ x: pointX, y: pointY });
  let targetX = pointX + 15;
  let targetY = pointY + 15;

  const windowWidth = 440;
  const windowHeight = 320;

  if (targetX + windowWidth > display.bounds.x + display.bounds.width) {
    targetX = pointX - windowWidth - 10;
  }
  if (targetY + windowHeight > display.bounds.y + display.bounds.height) {
    targetY = pointY - windowHeight - 10;
  }

  targetX = Math.max(display.bounds.x + 8, Math.min(targetX, display.bounds.x + display.bounds.width - windowWidth - 8));
  targetY = Math.max(display.bounds.y + 8, Math.min(targetY, display.bounds.y + display.bounds.height - windowHeight - 8));

  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.setPosition(targetX, targetY);
  }
  return { targetX, targetY };
}

async function triggerTranslationFlow(overrideText?: string) {
  let text = overrideText;

  if (!text) {
    text = await captureSelectedText();
  }

  if (!text || !text.trim()) {
    console.log('No text selected or clipboard empty');
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const { targetX, targetY } = positionPopupAtPoint(cursor.x, cursor.y);

  if (popupWindow) {
    showPopupWindowWithFocus();

    popupWindow.webContents.send('trigger-translate', {
      text: text.trim(),
      x: targetX,
      y: targetY,
    });
  }
}

async function triggerOcrSnipFlow() {
  try {
    if (!snipWindow || snipWindow.isDestroyed()) {
      createSnipWindow();
    }

    // Hide unpinned popup temporarily so it doesn't cover the area user wants to capture
    if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible() && !(popupWindow as any).isPinned) {
      popupWindow.hide();
    }

    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const scaleFactor = display.scaleFactor || 1;
    const captureWidth = Math.round(display.bounds.width * scaleFactor);
    const captureHeight = Math.round(display.bounds.height * scaleFactor);

    // Prepare transparent overlay window with opacity=0 until Renderer commits a clean frame
    if (snipWindow && !snipWindow.isDestroyed()) {
      snipWindow.setOpacity(0);
      snipWindow.setBounds({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
      });
      snipWindow.setAlwaysOnTop(true, 'screen-saver');
      snipWindow.showInactive();

      snipWindow.webContents.send('snip-screen-capture', {
        scaleFactor,
        ocrLanguage: (activeSettings.ocrLanguage && activeSettings.ocrLanguage !== 'eng+jpn+kor+chi_sim') ? activeSettings.ocrLanguage : 'auto',
        displayBounds: display.bounds,
      });

      registerEscapeShortcut();
    }

    // Capture screen in native C++ memory while user moves mouse (snipWindow is excluded via setContentProtection)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: captureWidth,
        height: captureHeight,
      },
    });

    if (sources && sources.length > 0) {
      const matchedSource =
        sources.find((s) => String(s.display_id) === String(display.id)) || sources[0];
      lastCapturedScreen = matchedSource.thumbnail;
    }
  } catch (err) {
    console.error('Failed to start OCR screen snip flow:', err);
  }
}

function registerHotkeys() {
  globalShortcut.unregisterAll();

  // 1. Register Text Selection Translation Hotkey
  const targetHotkey = activeSettings.hotkey || 'F8';
  try {
    const ok = globalShortcut.register(targetHotkey, () => {
      triggerTranslationFlow();
    });
    if (ok) {
      console.log(`Global text hotkey ${targetHotkey} registered successfully.`);
    } else {
      console.warn(`${targetHotkey} hotkey failed to register, falling back to F8...`);
      if (targetHotkey !== 'F8') {
        globalShortcut.register('F8', () => triggerTranslationFlow());
      }
    }
  } catch (err) {
    console.error('Text hotkey registration error:', err);
  }

  // 2. Register Image OCR Snip Hotkey
  const targetOcrHotkey = activeSettings.ocrHotkey || 'F9';
  if (targetOcrHotkey && targetOcrHotkey !== targetHotkey) {
    try {
      const okOcr = globalShortcut.register(targetOcrHotkey, () => {
        triggerOcrSnipFlow();
      });
      if (okOcr) {
        console.log(`Global OCR hotkey ${targetOcrHotkey} registered successfully.`);
      } else {
        console.warn(`${targetOcrHotkey} OCR hotkey failed to register, falling back to F9...`);
        if (targetOcrHotkey !== 'F9' && targetHotkey !== 'F9') {
          globalShortcut.register('F9', () => triggerOcrSnipFlow());
        }
      }
    } catch (err) {
      console.error('OCR hotkey registration error:', err);
    }
  }
}

// App lifecycle
app.whenReady().then(() => {
  const isHiddenBoot = process.argv.includes('--hidden');

  if (!isHiddenBoot) {
    createSplashWindow();
  }
  initVbsHelper();
  createPopupWindow();
  createSnipWindow();
  if (!isHiddenBoot) {
    createSettingsWindow();
  }
  createTray();
  registerHotkeys();
  applyAutoStartSetting(activeSettings.autoStartWithWindows ?? true);

  // Auto-resolve active model from LM Studio server on startup
  fetchAvailableModels(activeSettings.lmStudioUrl)
    .then((models) => {
      if (models && models.length > 0) {
        activeSettings.modelName = models[0];
        console.log(`Auto-detected active LM Studio model: ${models[0]}`);
      }
    })
    .catch((err) => {
      console.warn('Initial model detection warning:', err.message);
    });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPopupWindow();
    }
  });

  // Background update check on LAN server after startup
  if (activeSettings.autoCheckUpdate !== false) {
    setTimeout(() => {
      runBackgroundUpdateCheck();
    }, 8000);
  }
});

async function runBackgroundUpdateCheck() {
  try {
    const serverUrl = activeSettings.updateServerUrl || 'http://192.168.1.12:8080/updates';
    const result = await checkForUpdates(serverUrl);
    if (result.hasUpdate && result.updateInfo) {
      const { response } = await dialog.showMessageBox({
        type: 'question',
        title: 'AI Local Translator - Update Available',
        message: `A new version (v${result.updateInfo.version}) is available on your local network!`,
        detail: `Current version: v${result.currentVersion}\n\nWhat's new in v${result.updateInfo.version}:\n${result.updateInfo.releaseNotes || 'Performance improvements and bug fixes.'}\n\nWould you like to open Settings to download and install this update?`,
        buttons: ['Open Update Settings', 'Remind Later'],
        defaultId: 0,
        cancelId: 1,
        icon: appIcon,
      });

      if (response === 0) {
        createSettingsWindow('updates');
      }
    }
  } catch (e) {}
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  terminateOcrWorker();
});

// IPC Handlers
ipcMain.handle('get-settings', () => activeSettings);

ipcMain.handle('save-settings', (_, newSettings: AppSettings) => {
  activeSettings = { ...activeSettings, ...newSettings };
  saveSettingsToDisk(activeSettings);
  applyAutoStartSetting(activeSettings.autoStartWithWindows ?? true);
  registerHotkeys();
  updateTrayMenu();
  return activeSettings;
});

ipcMain.handle('fetch-models', async (_, baseUrl: string) => {
  try {
    return await fetchAvailableModels(baseUrl);
  } catch (err: any) {
    throw new Error(err.message || 'Could not fetch models');
  }
});

ipcMain.handle('read-clipboard', () => clipboard.readText());

ipcMain.on('copy-to-clipboard', (_, text: string) => {
  clipboard.writeText(text);
});

ipcMain.handle('get-history', () => loadHistory());

ipcMain.handle('save-history', (_, history: TranslationHistoryItem[]) => {
  saveHistoryToDisk(history);
  return true;
});

ipcMain.handle('clear-history', () => {
  saveHistoryToDisk([]);
  return true;
});

// Auto-Updater IPC
ipcMain.handle('check-for-updates', async () => {
  const serverUrl = activeSettings.updateServerUrl || 'http://192.168.1.12:8080/updates';
  return await checkForUpdates(serverUrl);
});

ipcMain.handle('download-and-apply-update', async (event, downloadUrl: string) => {
  const filePath = await downloadUpdate(downloadUrl, (pct) => {
    event.sender.send('update-download-progress', pct);
  });
  applyUpdateAndRestart(filePath);
  return true;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.on('close-popup', () => {
  hidePopupWindow();
});

ipcMain.on('set-pinned', (_, pinned: boolean) => {
  if (popupWindow) {
    (popupWindow as any).isPinned = pinned;
    popupWindow.setAlwaysOnTop(true, pinned ? 'screen-saver' : 'normal');
  }
});

ipcMain.on('resize-popup', (_, { width, height }: { width: number; height: number }) => {
  if (popupWindow) {
    popupWindow.setSize(Math.max(360, width), Math.max(200, height));
  }
});

// Dedicated OCR Dialog IPC handlers
ipcMain.on('close-ocr-dialog', () => {
  hideOcrDialogWindow();
});

ipcMain.on('set-ocr-pinned', (_, pinned: boolean) => {
  if (ocrDialogWindow) {
    (ocrDialogWindow as any).isPinned = pinned;
    ocrDialogWindow.setAlwaysOnTop(true, pinned ? 'screen-saver' : 'normal');
  }
});

ipcMain.on('resize-ocr-dialog', (_, { width, height }: { width: number; height: number }) => {
  if (ocrDialogWindow) {
    ocrDialogWindow.setSize(Math.max(800, width), Math.max(480, height));
  }
});

ipcMain.on('open-settings-window', (_, tab?: string) => {
  createSettingsWindow(tab);
});

ipcMain.on('start-ocr-capture', () => {
  triggerOcrSnipFlow();
});

ipcMain.on('snip-ready-to-show', () => {
  if (snipWindow && !snipWindow.isDestroyed()) {
    snipWindow.setOpacity(1);
    snipWindow.focus();
  }
});

ipcMain.on('cancel-snip-selection', () => {
  hideSnipWindow();
});

ipcMain.on('complete-snip-selection', async (_, payload: SnipSelectionResult) => {
  hideSnipWindow();

  const { rect, viewportWidth, viewportHeight, ocrLanguage, screenX, screenY } = payload;

  if (!lastCapturedScreen) {
    return;
  }

  // Native C++ crop & upscale on Electron.NativeImage (< 1ms)
  const imgSize = lastCapturedScreen.getSize();
  const scaleX = imgSize.width / Math.max(1, viewportWidth);
  const scaleY = imgSize.height / Math.max(1, viewportHeight);

  const cropX = Math.max(0, Math.round(rect.x * scaleX));
  const cropY = Math.max(0, Math.round(rect.y * scaleY));
  const cropW = Math.min(imgSize.width - cropX, Math.round(rect.width * scaleX));
  const cropH = Math.min(imgSize.height - cropY, Math.round(rect.height * scaleY));

  if (cropW <= 2 || cropH <= 2) {
    return;
  }

  let croppedImg = lastCapturedScreen.crop({
    x: cropX,
    y: cropY,
    width: cropW,
    height: cropH,
  });

  if (cropH < 120) {
    croppedImg = croppedImg.resize({
      width: cropW * 2,
      height: cropH * 2,
      quality: 'best',
    });
  }

  const croppedImageDataUrl = croppedImg.toDataURL();

  // Persist quick-selected OCR language if changed during snipping
  if (ocrLanguage && ocrLanguage !== activeSettings.ocrLanguage) {
    activeSettings.ocrLanguage = ocrLanguage;
    saveSettingsToDisk(activeSettings);
  }

  const display =
    screen.getDisplayNearestPoint({ x: screenX, y: screenY }) || screen.getPrimaryDisplay();
  const workArea = display.workArea;

  const maxWidth = Math.round(workArea.width * 0.92);
  const maxHeight = Math.round(workArea.height * 0.90);

  // Minimum size guaranteed to fit all header toolbar buttons without clipping
  const minWinW = Math.min(maxWidth, 800);
  const minWinH = Math.min(maxHeight, 480);

  // Target window width and height to comfortably display image at 1:1 scale + UI frame
  const targetWinW = Math.max(minWinW, Math.min(maxWidth, cropW + 40));
  const targetWinH = Math.max(minWinH, Math.min(maxHeight, cropH + 100));

  let posX = Math.round(screenX + (cropW - targetWinW) / 2);
  let posY = Math.round(screenY + (cropH - targetWinH) / 2);

  if (posX < workArea.x) posX = workArea.x + 16;
  if (posX + targetWinW > workArea.x + workArea.width) posX = workArea.x + workArea.width - targetWinW - 16;
  if (posY < workArea.y) posY = workArea.y + 16;
  if (posY + targetWinH > workArea.y + workArea.height) posY = workArea.y + workArea.height - targetWinH - 16;

  if (!ocrDialogWindow || ocrDialogWindow.isDestroyed()) {
    createOcrDialogWindow();
  }

  ocrDialogWindow!.setBounds({
    x: posX,
    y: posY,
    width: targetWinW,
    height: targetWinH,
  });

  ocrDialogWindow!.show();
  ocrDialogWindow!.focus();

  ocrDialogWindow?.webContents.send('ocr-state-change', {
    status: 'processing',
    message: 'Extracting text from image (OCR)...',
    imagePreview: croppedImageDataUrl,
  });

  try {
    const ocrResult = await extractTextAndBlocksFromImage(
      croppedImageDataUrl,
      ocrLanguage || activeSettings.ocrLanguage || 'auto',
      (progressMsg) => {
        ocrDialogWindow?.webContents.send('ocr-state-change', {
          status: 'processing',
          message: progressMsg,
          imagePreview: croppedImageDataUrl,
        });
      }
    );

    const { fullText, blocks } = ocrResult;

    if (!fullText || !fullText.trim() || blocks.length === 0) {
      ocrDialogWindow?.webContents.send('ocr-state-change', {
        status: 'error',
        message: 'No readable text found in the selected area. Try selecting a clearer region or switching the OCR language.',
        imagePreview: croppedImageDataUrl,
      });
      return;
    }

    const targetLang = activeSettings.targetLanguage || 'Vietnamese';
    ocrDialogWindow?.webContents.send('ocr-state-change', {
      status: 'processing',
      message: `Translating ${blocks.length} text region${blocks.length > 1 ? 's' : ''} with LM Studio...`,
      imagePreview: croppedImageDataUrl,
    });

    const visualBlocks = await translateBlocks({
      baseUrl: activeSettings.lmStudioUrl,
      model: activeSettings.modelName,
      blocks,
      targetLanguage: targetLang,
      reasoningEffort: activeSettings.reasoningEffort || 'none',
      systemPromptTemplate: activeSettings.systemPrompt,
    });

    const fullTranslatedText = visualBlocks.map((b) => b.translatedText).join('\n\n');

    ocrDialogWindow?.webContents.send('ocr-state-change', {
      status: 'done',
      imagePreview: croppedImageDataUrl,
    });

    // Send visual translation event to dedicated OCR Dialog
    ocrDialogWindow?.webContents.send('trigger-visual-translate', {
      imagePreview: croppedImageDataUrl,
      blocks: visualBlocks,
      fullOriginalText: fullText,
      fullTranslatedText,
      targetLanguage: targetLang,
    });

    // Save to history
    const history = loadHistory();
    saveHistoryToDisk([
      {
        id: Date.now().toString(),
        originalText: fullText,
        translatedText: fullTranslatedText,
        targetLanguage: targetLang,
        timestamp: Date.now(),
      },
      ...history,
    ]);
  } catch (err: any) {
    ocrDialogWindow?.webContents.send('ocr-state-change', {
      status: 'error',
      message: err.message || 'Error extracting text from image.',
      imagePreview: croppedImageDataUrl,
    });
  }
});

ipcMain.on('start-translation', async (event, { text, targetLang }: { text: string; targetLang?: string }) => {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  const lang = targetLang || activeSettings.targetLanguage || 'Vietnamese';

  try {
    currentAbortController = await streamTranslation({
      baseUrl: activeSettings.lmStudioUrl,
      model: activeSettings.modelName,
      text,
      targetLanguage: lang,
      systemPromptTemplate: activeSettings.systemPrompt,
      reasoningEffort: activeSettings.reasoningEffort || 'none',
      onChunk: (chunk) => {
        event.sender.send('translate-chunk', chunk);
      },
      onComplete: (fullText) => {
        event.sender.send('translate-complete', fullText);

        // Save to history
        const history = loadHistory();
        const newItem: TranslationHistoryItem = {
          id: Date.now().toString(),
          originalText: text,
          translatedText: fullText,
          targetLanguage: lang,
          timestamp: Date.now(),
        };
        saveHistoryToDisk([newItem, ...history]);
      },
      onError: (err) => {
        event.sender.send('translate-error', err.message);
      },
    });
  } catch (err: any) {
    event.sender.send('translate-error', err.message || 'Translation failed');
  }
});

ipcMain.on('cancel-translation', () => {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
});
