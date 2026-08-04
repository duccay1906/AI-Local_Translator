import { app, BrowserWindow, globalShortcut, ipcMain, screen, clipboard, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { streamTranslation, fetchAvailableModels } from './lmstudio';
import { AppSettings, TranslationHistoryItem } from '../src/types';

let popupWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentAbortController: { abort: () => void } | null = null;

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
  lmStudioUrl: 'http://192.168.1.130:1234',
  modelName: '',
  targetLanguage: 'Vietnamese',
  systemPrompt: 'You are a professional translator. Translate the given text into {targetLanguage}. Output ONLY the translated text without extra explanation.',
  triggerMode: 'hotkey',
  hotkey: 'F8',
  autoCopySelection: true,
  theme: 'dark',
  opacity: 0.92,
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

  popupWindow.webContents.on('before-input-event', (event, input) => {
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
      globalShortcut.unregister('Escape');
    } catch (e) {}
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.focus();
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
    settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#settings`);
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'settings' });
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
      label: '📌 Show Translation Popup',
      click: () => triggerTranslationFlow(),
    },
    { type: 'separator' },
    {
      label: `🌐 Target Language: ${activeSettings.targetLanguage}`,
      enabled: false,
    },
    {
      label: `⌨️ Shortcut: ${activeSettings.hotkey}`,
      enabled: false,
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

import { exec } from 'child_process';

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
    const prevText = clipboard.readText();
    
    // Execute VBScript to trigger Ctrl+C keypress in current active window after modifier keyup
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
      globalShortcut.unregister('Escape');
    } catch (e) {}
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

  // Register global Escape shortcut while popup is visible so Esc ALWAYS closes popup instantly from anywhere in Windows
  try {
    globalShortcut.unregister('Escape');
  } catch (e) {}

  try {
    globalShortcut.register('Escape', () => {
      hidePopupWindow();
    });
  } catch (e) {
    console.warn('Failed to register global Escape:', e);
  }
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
  const display = screen.getDisplayNearestPoint(cursor);

  // Position popup window near cursor
  let targetX = cursor.x + 15;
  let targetY = cursor.y + 15;

  const windowWidth = 440;
  const windowHeight = 320;

  // Boundary check
  if (targetX + windowWidth > display.bounds.x + display.bounds.width) {
    targetX = cursor.x - windowWidth - 10;
  }
  if (targetY + windowHeight > display.bounds.y + display.bounds.height) {
    targetY = cursor.y - windowHeight - 10;
  }

  if (popupWindow) {
    popupWindow.setPosition(Math.max(display.bounds.x, targetX), Math.max(display.bounds.y, targetY));
    showPopupWindowWithFocus();

    popupWindow.webContents.send('trigger-translate', {
      text: text.trim(),
      x: targetX,
      y: targetY,
    });
  }
}

function registerHotkeys() {
  globalShortcut.unregisterAll();
  activeSettings.hotkey = 'F8';
  try {
    const ok = globalShortcut.register('F8', () => {
      triggerTranslationFlow();
    });
    if (ok) {
      console.log('Global hotkey F8 registered successfully.');
    } else {
      console.warn('F8 hotkey failed to register, trying F9...');
      globalShortcut.register('F9', () => triggerTranslationFlow());
    }
  } catch (err) {
    console.error('Hotkey registration error:', err);
  }
}

// App lifecycle
app.whenReady().then(() => {
  createSplashWindow();
  initVbsHelper();
  createPopupWindow();
  createSettingsWindow();
  createTray();
  registerHotkeys();

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
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC Handlers
ipcMain.handle('get-settings', () => activeSettings);

ipcMain.handle('save-settings', (_, newSettings: AppSettings) => {
  activeSettings = { ...activeSettings, ...newSettings };
  saveSettingsToDisk(activeSettings);
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

ipcMain.on('close-popup', () => {
  if (popupWindow) popupWindow.hide();
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

ipcMain.on('open-settings-window', () => {
  createSettingsWindow();
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
