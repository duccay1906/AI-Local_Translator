import { app, BrowserWindow, globalShortcut, ipcMain, screen, clipboard, Tray, Menu, nativeImage, desktopCapturer, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { exec, execFile, spawn, ChildProcess } from 'child_process';
import { streamTranslation, fetchAvailableModels, translateBlocks, streamVisionTranslation } from './lmstudio';
import { extractTextFromImage, extractTextAndBlocksFromImage, terminateOcrWorker } from './ocr';
import { checkForUpdates, downloadUpdate, applyUpdateAndRestart, openUpdateFolder } from './updater';
import { AppSettings, TranslationHistoryItem, SnipSelectionResult, ReplyTone, QuickReplyPayload } from '../src/types';

// Ensure working directory is always local (prevents UNC path failures when Setup.exe is launched directly from a LAN share)
try {
  if (process.cwd().startsWith('\\\\')) {
    process.chdir(app.getPath('temp'));
  }
} catch (e) {}

// Self-healing environment PATH: ensure Windows System32 and PowerShell paths are ALWAYS present
const SYSTEM_ROOT = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
const SYSTEM32_DIR = path.join(SYSTEM_ROOT, 'System32');
const POWERSHELL_DIR = path.join(SYSTEM32_DIR, 'WindowsPowerShell', 'v1.0');
const WSCRIPT_EXE = path.join(SYSTEM32_DIR, 'wscript.exe');
const POWERSHELL_EXE = path.join(POWERSHELL_DIR, 'powershell.exe');
const REG_EXE = path.join(SYSTEM32_DIR, 'reg.exe');

try {
  const currentPath = process.env.PATH || '';
  const parts = currentPath.split(';');
  const needed = [SYSTEM32_DIR, SYSTEM_ROOT, POWERSHELL_DIR];
  const missing = needed.filter((dir) => !parts.some((p) => p.toLowerCase() === dir.toLowerCase()));
  if (missing.length > 0) {
    process.env.PATH = `${missing.join(';')};${currentPath}`;
  }
} catch (e) {}

// Global uncaught exception protection to avoid raw JavaScript error dialogs
process.on('uncaughtException', (err) => {
  console.error('Unhandled main process exception caught:', err);
});

let popupWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let snipWindow: BrowserWindow | null = null;
let ocrDialogWindow: BrowserWindow | null = null;
let replyWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentAbortController: { abort: () => void } | null = null;
let currentVisionAbortController: { abort: () => void } | null = null;
let currentReplyAbortController: { abort: () => void } | null = null;
let latestReplyRequestId = 0;
let lastCapturedScreen: Electron.NativeImage | null = null;
let lastVisionSnippet: { imagePreview: string; targetLanguage: string } | null = null;
let lastReplySnippet: QuickReplyPayload | null = null;
let lastReplyWasSelectAll = false;
let lastTargetChatHwnd = '0';
let lastTargetChatPid = 0;
let winInputWorker: ChildProcess | null = null;
let winInputWorkerReady = false;
let winInputPendingResolvers: Array<(line: string) => void> = [];
let winInputStdoutBuffer = '';

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
  replyHotkey: 'F10',
  outgoingLanguage: 'Korean',
  outgoingTone: 'polite',
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
    const regBin = fs.existsSync(REG_EXE) ? REG_EXE : 'reg.exe';
    if (enabled) {
      execFile(regBin, ['add', regKey, '/v', regName, '/t', 'REG_SZ', '/d', `"${targetExe}" --hidden`, '/f'], (err) => {
        if (err) console.warn('Registry auto-start add warning:', err.message);
      });
    } else {
      execFile(regBin, ['delete', regKey, '/v', regName, '/f'], (err) => {
        if (err) console.warn('Registry auto-start delete warning:', err.message);
      });
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

function createReplyWindow(): BrowserWindow {
  if (replyWindow && !replyWindow.isDestroyed()) {
    return replyWindow;
  }

  replyWindow = new BrowserWindow({
    width: 480,
    height: 360,
    minWidth: 420,
    minHeight: 310,
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
    replyWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#reply`);
  } else {
    replyWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'reply' });
  }

  replyWindow.webContents.on('before-input-event', (_, input) => {
    const key = (input.key || '').toLowerCase();
    const code = (input.code || '').toLowerCase();
    if (key === 'escape' || key === 'esc' || code === 'escape') {
      hideReplyWindow();
    }
  });

  replyWindow.on('focus', () => {
    if (replyWindow && !replyWindow.isDestroyed() && replyWindow.isVisible()) {
      registerReplyActionShortcuts();
    }
  });

  replyWindow.on('blur', () => {
    if (Date.now() - replyShownTimestamp < 300) return;
    if (replyWindow && !replyWindow.isDestroyed() && !(replyWindow as any).isPinned) {
      hideReplyWindow();
    } else {
      unregisterReplyActionShortcuts();
    }
  });

  replyWindow.on('closed', () => {
    replyWindow = null;
  });

  return replyWindow;
}

let replyShownTimestamp = 0;

function registerReplyActionShortcuts() {
  try {
    globalShortcut.unregister('Escape');
  } catch (e) {}
  try {
    globalShortcut.unregister('Return');
  } catch (e) {}

  try {
    globalShortcut.register('Escape', () => {
      if (replyWindow && !replyWindow.isDestroyed() && replyWindow.isVisible()) {
        hideReplyWindow();
        return;
      }
      if (snipWindow && !snipWindow.isDestroyed() && snipWindow.isVisible()) {
        hideSnipWindow();
        return;
      }
      hidePopupWindow();
    });
  } catch (e) {
    console.warn('Failed to register global Escape for reply:', e);
  }

  try {
    globalShortcut.register('Return', () => {
      if (replyWindow && !replyWindow.isDestroyed() && replyWindow.isVisible()) {
        replyWindow.webContents.send('reply-confirm-hotkey');
      }
    });
  } catch (e) {
    console.warn('Failed to register global Return for reply:', e);
  }
}

function unregisterReplyActionShortcuts() {
  try {
    globalShortcut.unregister('Return');
  } catch (e) {}
  try {
    if (
      (!popupWindow || popupWindow.isDestroyed() || !popupWindow.isVisible()) &&
      (!snipWindow || snipWindow.isDestroyed() || !snipWindow.isVisible())
    ) {
      globalShortcut.unregister('Escape');
    }
  } catch (e) {}
}

function hideReplyWindow() {
  unregisterReplyActionShortcuts();
  if (replyWindow && !replyWindow.isDestroyed()) {
    try {
      replyWindow.blur();
    } catch (e) {}
    replyWindow.hide();
  }
}

function createSettingsWindow(initialTab?: string) {
  const hash = initialTab ? `settings?tab=${initialTab}` : 'settings';
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    if (!settingsWindow.isVisible()) {
      settingsWindow.show();
    }
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

  const showSettings = () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      if (!settingsWindow.isVisible()) {
        settingsWindow.show();
      }
      settingsWindow.focus();
    }
  };

  settingsWindow.once('ready-to-show', () => {
    setTimeout(showSettings, 200);
  });

  settingsWindow.webContents.once('did-finish-load', () => {
    setTimeout(showSettings, 300);
  });

  // Fallback safety timer so window is guaranteed to show
  setTimeout(showSettings, 800);

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
    {
      label: '💬 Quick Chat Reply & Replace',
      click: () => triggerQuickReplyFlow(),
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
    {
      label: `💬 Reply Shortcut: ${activeSettings.replyHotkey || 'F10'}`,
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
const fallbackVbsPath = path.join(app.getPath('temp'), 'send_copy.vbs');

const vbsSelectCopyPath = path.join(app.getPath('userData'), 'send_select_copy.vbs');
const fallbackVbsSelectCopyPath = path.join(app.getPath('temp'), 'send_select_copy.vbs');

const vbsPastePath = path.join(app.getPath('userData'), 'send_paste.vbs');
const fallbackVbsPastePath = path.join(app.getPath('temp'), 'send_paste.vbs');

const vbsSelectPastePath = path.join(app.getPath('userData'), 'send_select_paste.vbs');
const fallbackVbsSelectPastePath = path.join(app.getPath('temp'), 'send_select_paste.vbs');

function writeVbsPair(primary: string, fallback: string, content: string) {
  try {
    fs.writeFileSync(primary, content, 'utf-8');
  } catch (err) {
    console.error('Failed to write primary VBS helper:', err);
  }
  try {
    fs.writeFileSync(fallback, content, 'utf-8');
  } catch (e) {}
}

function initVbsHelper() {
  const copyContent = 'WScript.Sleep 120\r\nSet WshShell = WScript.CreateObject("WScript.Shell")\r\nWshShell.SendKeys "^c"';
  const selectCopyContent = 'WScript.Sleep 90\r\nSet WshShell = WScript.CreateObject("WScript.Shell")\r\nWshShell.SendKeys "^a"\r\nWScript.Sleep 60\r\nWshShell.SendKeys "^c"';
  const pasteContent = [
    'Set WshShell = WScript.CreateObject("WScript.Shell")',
    'If WScript.Arguments.Count > 0 Then',
    '  On Error Resume Next',
    '  WshShell.AppActivate CLng(WScript.Arguments(0))',
    '  On Error GoTo 0',
    '  WScript.Sleep 80',
    'Else',
    '  WScript.Sleep 120',
    'End If',
    'WshShell.SendKeys "^v"',
  ].join('\r\n');
  const selectPasteContent = [
    'Set WshShell = WScript.CreateObject("WScript.Shell")',
    'If WScript.Arguments.Count > 0 Then',
    '  On Error Resume Next',
    '  WshShell.AppActivate CLng(WScript.Arguments(0))',
    '  On Error GoTo 0',
    '  WScript.Sleep 80',
    'Else',
    '  WScript.Sleep 120',
    'End If',
    'WshShell.SendKeys "^a"',
    'WScript.Sleep 55',
    'WshShell.SendKeys "^v"',
  ].join('\r\n');

  writeVbsPair(vbsPath, fallbackVbsPath, copyContent);
  writeVbsPair(vbsSelectCopyPath, fallbackVbsSelectCopyPath, selectCopyContent);
  writeVbsPair(vbsPastePath, fallbackVbsPastePath, pasteContent);
  writeVbsPair(vbsSelectPastePath, fallbackVbsSelectPastePath, selectPasteContent);

  initWinInputWorker();
}

function initWinInputWorker() {
  try {
    const tempDir = app.getPath('temp');
    const workerPs1 = path.join(tempDir, 'ai_translator_win_input_helper.ps1');
    const psContent = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Threading;
using System.Runtime.InteropServices;

public class WinInputHelper {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const byte VK_CONTROL = 0x11;
    private const byte VK_SHIFT = 0x10;
    private const byte VK_MENU = 0x12;
    private const byte VK_A = 0x41;
    private const byte VK_V = 0x56;

    public static string CaptureForeground() {
        IntPtr hwnd = GetForegroundWindow();
        uint pid = 0;
        if (hwnd != IntPtr.Zero) {
            GetWindowThreadProcessId(hwnd, out pid);
        }
        return "FG:" + hwnd.ToInt64().ToString() + ":" + pid.ToString();
    }

    public static bool ForceActivate(long hwndVal) {
        if (hwndVal == 0) return false;
        IntPtr targetHwnd = new IntPtr(hwndVal);
        if (!IsWindow(targetHwnd)) return false;

        if (IsIconic(targetHwnd)) {
            ShowWindow(targetHwnd, 9); // SW_RESTORE
        }

        for (int attempt = 0; attempt < 12; attempt++) {
            IntPtr fgHwnd = GetForegroundWindow();
            if (fgHwnd == targetHwnd) return true;

            uint d1 = 0, d2 = 0;
            uint fgThread = GetWindowThreadProcessId(fgHwnd, out d1);
            uint targetThread = GetWindowThreadProcessId(targetHwnd, out d2);
            uint curThread = GetCurrentThreadId();

            bool attachedFg = false;
            bool attachedTarget = false;
            if (fgThread != 0 && fgThread != curThread) {
                attachedFg = AttachThreadInput(curThread, fgThread, true);
            }
            if (targetThread != 0 && targetThread != curThread) {
                attachedTarget = AttachThreadInput(curThread, targetThread, true);
            }

            // Satisfy Windows ForegroundLockTimeout before SetForegroundWindow
            keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            BringWindowToTop(targetHwnd);
            SetForegroundWindow(targetHwnd);

            if (attachedTarget) AttachThreadInput(curThread, targetThread, false);
            if (attachedFg) AttachThreadInput(curThread, fgThread, false);

            Thread.Sleep(20);
            if (GetForegroundWindow() == targetHwnd) return true;
        }
        return GetForegroundWindow() == targetHwnd;
    }

    public static void SendCtrlKey(byte vk) {
        keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

        keybd_event(VK_CONTROL, 0x1D, 0, UIntPtr.Zero);
        Thread.Sleep(15);
        keybd_event(vk, 0, 0, UIntPtr.Zero);
        Thread.Sleep(15);
        keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        Thread.Sleep(15);
        keybd_event(VK_CONTROL, 0x1D, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    public static string SelectAllAndPaste(long hwndVal) {
        ForceActivate(hwndVal);
        Thread.Sleep(55);
        SendCtrlKey(VK_A);
        Thread.Sleep(55);
        SendCtrlKey(VK_V);
        return "PASTED:OK";
    }
}
'@
[Console]::Out.WriteLine("READY")
[Console]::Out.Flush()

while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line -or $line -eq "EXIT") { break }
    if ($line -eq "CAPTURE") {
        $res = [WinInputHelper]::CaptureForeground()
        [Console]::Out.WriteLine($res)
        [Console]::Out.Flush()
    } elseif ($line.StartsWith("PASTE:")) {
        $hwndStr = $line.Substring(6).Trim()
        $hwndVal = [long]0
        [long]::TryParse($hwndStr, [ref]$hwndVal) | Out-Null
        $res = [WinInputHelper]::SelectAllAndPaste($hwndVal)
        [Console]::Out.WriteLine($res)
        [Console]::Out.Flush()
    }
}
`;
    fs.writeFileSync(workerPs1, psContent, 'utf-8');

    const psBin = fs.existsSync(POWERSHELL_EXE) ? POWERSHELL_EXE : 'powershell.exe';
    const worker = spawn(
      psBin,
      ['-WindowStyle', 'Hidden', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', workerPs1],
      {
        cwd: tempDir,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore'],
      }
    );
    winInputWorker = worker;

    worker.on('error', (err) => {
      console.warn('WinInputWorker process error:', err.message);
      winInputWorkerReady = false;
      winInputWorker = null;
    });

    if (worker.stdout) {
      worker.stdout.setEncoding('utf8');
      worker.stdout.on('data', (chunk: string) => {
        winInputStdoutBuffer += chunk;
        const lines = winInputStdoutBuffer.split(/\r?\n/);
        winInputStdoutBuffer = lines.pop() || '';
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          if (line === 'READY') {
            winInputWorkerReady = true;
            continue;
          }
          const resolver = winInputPendingResolvers.shift();
          if (resolver) {
            resolver(line);
          }
        }
      });
    }

    worker.on('exit', () => {
      winInputWorkerReady = false;
      winInputWorker = null;
      while (winInputPendingResolvers.length > 0) {
        const r = winInputPendingResolvers.shift();
        if (r) r('');
      }
    });
  } catch (err) {
    console.warn('Failed to init WinInputWorker:', err);
  }
}

function sendWinInputCommand(cmd: string, timeoutMs = 400): Promise<string> {
  if (!winInputWorker || !winInputWorkerReady || !winInputWorker.stdin || !winInputWorker.stdin.writable) {
    return Promise.resolve('');
  }
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        const idx = winInputPendingResolvers.indexOf(onLine);
        if (idx >= 0) winInputPendingResolvers.splice(idx, 1);
        resolve('');
      }
    }, timeoutMs);

    const onLine = (line: string) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(line);
      }
    };

    winInputPendingResolvers.push(onLine);
    try {
      winInputWorker!.stdin!.write(cmd + '\n');
    } catch (e) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        const idx = winInputPendingResolvers.indexOf(onLine);
        if (idx >= 0) winInputPendingResolvers.splice(idx, 1);
        resolve('');
      }
    }
  });
}

async function captureTargetChatWindow(): Promise<void> {
  const resp = await sendWinInputCommand('CAPTURE', 200);
  if (resp && resp.startsWith('FG:')) {
    const parts = resp.split(':');
    const hwnd = parts[1] || '0';
    const pid = parseInt(parts[2] || '0', 10);
    // Only record external application windows (never our own Electron process)
    if (hwnd !== '0' && pid > 0 && pid !== process.pid) {
      lastTargetChatHwnd = hwnd;
      lastTargetChatPid = pid;
    }
  }
}

async function runVbsHelper(primary: string, fallback: string, args: string[] = []): Promise<void> {
  const scriptToUse = fs.existsSync(primary) ? primary : fallback;
  const wscriptBin = fs.existsSync(WSCRIPT_EXE) ? WSCRIPT_EXE : 'wscript.exe';
  await new Promise<void>((resolve) => {
    // Use wscript.exe (GUI subsystem) + windowsHide so Windows Terminal never steals focus from active window
    execFile(
      wscriptBin,
      ['//B', '//Nologo', scriptToUse, ...args],
      { windowsHide: true, cwd: app.getPath('temp') },
      (error) => {
        if (error) {
          console.warn('wscript execution warning:', error.message);
        }
        resolve();
      }
    );
  });
}

async function pollClipboardText(maxWaitMs = 250): Promise<string> {
  let captured = clipboard.readText();
  if (captured && captured.trim()) {
    return captured.trim();
  }
  const steps = Math.ceil(maxWaitMs / 50);
  for (let i = 0; i < steps; i++) {
    await new Promise((r) => setTimeout(r, 50));
    captured = clipboard.readText();
    if (captured && captured.trim()) {
      return captured.trim();
    }
  }
  return '';
}

async function captureSelectedText(): Promise<string> {
  const previousText = clipboard.readText();
  clipboard.clear();

  await runVbsHelper(vbsPath, fallbackVbsPath);

  const captured = await pollClipboardText(250);
  if (captured) {
    return captured;
  }

  // If no new text was captured, restore previous clipboard so user data is not lost
  if (previousText && previousText.trim()) {
    clipboard.writeText(previousText);
    return previousText.trim();
  }

  return '';
}

async function captureChatInputText(): Promise<string> {
  const previousText = clipboard.readText();
  clipboard.clear();

  // 1. First check if user already highlighted a specific portion of text
  await runVbsHelper(vbsPath, fallbackVbsPath);
  let captured = await pollClipboardText(180);
  if (captured) {
    lastReplyWasSelectAll = false;
    return captured;
  }

  // 2. If nothing was highlighted, user is typing in a chat input box: auto-select all (Ctrl+A) and copy (Ctrl+C)
  await runVbsHelper(vbsSelectCopyPath, fallbackVbsSelectCopyPath);
  captured = await pollClipboardText(250);
  if (captured) {
    lastReplyWasSelectAll = true;
    return captured;
  }

  // Restore previous clipboard if input box was empty
  if (previousText) {
    clipboard.writeText(previousText);
  }
  lastReplyWasSelectAll = true;
  return '';
}

async function replaceTextInActiveChat(translatedText: string) {
  if (!translatedText || !translatedText.trim()) return;

  clipboard.writeText(translatedText.trim());
  hideReplyWindow();

  // Wait briefly for Electron window hide transition before restoring focus to target chat window
  await new Promise((r) => setTimeout(r, 40));

  // Primary path: Win32 ForceActivate(lastTargetChatHwnd) + SelectAll (Ctrl+A) + Paste (Ctrl+V)
  if (winInputWorkerReady && lastTargetChatHwnd !== '0') {
    const res = await sendWinInputCommand(`PASTE:${lastTargetChatHwnd}`, 800);
    if (res === 'PASTED:OK') {
      return;
    }
  }

  // Fallback path: VBScript AppActivate(PID) + Ctrl+A + Ctrl+V
  const pidArgs = lastTargetChatPid > 0 ? [String(lastTargetChatPid)] : [];
  await runVbsHelper(vbsSelectPastePath, fallbackVbsSelectPastePath, pidArgs);
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

async function startReplyStream(text: string, targetLang: string, tone: ReplyTone) {
  const requestId = ++latestReplyRequestId;

  if (currentReplyAbortController) {
    currentReplyAbortController.abort();
    currentReplyAbortController = null;
  }

  // Persist user's outgoing language and tone preference immediately
  if (targetLang !== activeSettings.outgoingLanguage || tone !== activeSettings.outgoingTone) {
    activeSettings.outgoingLanguage = targetLang;
    activeSettings.outgoingTone = tone;
    saveSettingsToDisk(activeSettings);
    updateTrayMenu();
  }

  if (!text || !text.trim()) return;

  activeSettings = loadSettings();

  try {
    currentReplyAbortController = await streamTranslation({
      baseUrl: activeSettings.lmStudioUrl,
      model: activeSettings.modelName,
      text: text.trim(),
      targetLanguage: targetLang,
      reasoningEffort: activeSettings.reasoningEffort || 'none',
      tone,
      onChunk: (chunk) => {
        if (requestId !== latestReplyRequestId) return;
        replyWindow?.webContents.send('reply-translate-chunk', chunk);
      },
      onComplete: (fullText) => {
        if (requestId !== latestReplyRequestId) return;
        replyWindow?.webContents.send('reply-translate-complete', fullText);

        const history = loadHistory();
        saveHistoryToDisk([
          {
            id: Date.now().toString(),
            originalText: text.trim(),
            translatedText: fullText,
            targetLanguage: `${targetLang} (${tone})`,
            timestamp: Date.now(),
          },
          ...history,
        ]);
      },
      onError: (err) => {
        if (requestId !== latestReplyRequestId) return;
        replyWindow?.webContents.send(
          'reply-translate-error',
          err.message || 'Could not connect to translation service'
        );
      },
    });
  } catch (err: any) {
    if (requestId !== latestReplyRequestId) return;
    replyWindow?.webContents.send(
      'reply-translate-error',
      err.message || 'Could not connect to translation service'
    );
  }
}

async function triggerQuickReplyFlow() {
  try {
    // 1. Record the active foreground window (the user's chat application) BEFORE showing our dialog
    await captureTargetChatWindow();

    // 2. Capture text currently in the active chat input box (or highlighted selection)
    const capturedText = await captureChatInputText();

    if (!replyWindow || replyWindow.isDestroyed()) {
      createReplyWindow();
    }

    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const winW = 480;
    const winH = 360;

    let posX = cursor.x - Math.round(winW / 2);
    let posY = cursor.y - winH - 20;

    if (posY < display.workArea.y + 10) {
      posY = cursor.y + 20;
    }
    posX = Math.max(
      display.workArea.x + 10,
      Math.min(posX, display.workArea.x + display.workArea.width - winW - 10)
    );
    posY = Math.max(
      display.workArea.y + 10,
      Math.min(posY, display.workArea.y + display.workArea.height - winH - 10)
    );

    // Hide other app windows so focus cleanly returns to the target chat app when Reply dialog closes
    if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible()) {
      settingsWindow.hide();
    }
    if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible() && !(popupWindow as any).isPinned) {
      popupWindow.hide();
    }

    replyShownTimestamp = Date.now();
    replyWindow!.setBounds({ x: posX, y: posY, width: winW, height: winH });
    app.focus({ steal: true });
    replyWindow!.show();
    replyWindow!.setAlwaysOnTop(true, 'pop-up-menu');
    replyWindow!.focus();
    replyWindow!.webContents.focus();
    registerReplyActionShortcuts();

    setTimeout(() => {
      if (replyWindow && !replyWindow.isDestroyed() && replyWindow.isVisible()) {
        replyWindow.focus();
        replyWindow.webContents.focus();
        registerReplyActionShortcuts();
      }
    }, 60);

    const outgoingLang = activeSettings.outgoingLanguage || 'Korean';
    const outgoingTone: ReplyTone = activeSettings.outgoingTone || 'polite';

    lastReplySnippet = {
      sourceText: capturedText,
      targetLanguage: outgoingLang,
      tone: outgoingTone,
    };

    const sendInit = () => {
      if (replyWindow && !replyWindow.isDestroyed()) {
        replyWindow.webContents.send('init-quick-reply', lastReplySnippet);
      }
    };

    if (replyWindow!.webContents.isLoading()) {
      replyWindow!.webContents.once('did-finish-load', () => {
        sendInit();
        if (capturedText && capturedText.trim()) {
          startReplyStream(capturedText, outgoingLang, outgoingTone);
        }
      });
    } else {
      sendInit();
      if (capturedText && capturedText.trim()) {
        startReplyStream(capturedText, outgoingLang, outgoingTone);
      }
    }
  } catch (err) {
    console.error('Failed to trigger quick reply flow:', err);
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

  // 3. Register Quick Chat Reply & Replace Hotkey
  const targetReplyHotkey = activeSettings.replyHotkey || 'F10';
  if (
    targetReplyHotkey &&
    targetReplyHotkey !== targetHotkey &&
    targetReplyHotkey !== targetOcrHotkey
  ) {
    try {
      const okReply = globalShortcut.register(targetReplyHotkey, () => {
        triggerQuickReplyFlow();
      });
      if (okReply) {
        console.log(`Global Reply hotkey ${targetReplyHotkey} registered successfully.`);
      } else {
        console.warn(`${targetReplyHotkey} Reply hotkey failed to register, falling back to F10...`);
        if (targetReplyHotkey !== 'F10' && targetHotkey !== 'F10' && targetOcrHotkey !== 'F10') {
          globalShortcut.register('F10', () => triggerQuickReplyFlow());
        }
      }
    } catch (err) {
      console.error('Reply hotkey registration error:', err);
    }
  }
}

// Enforce single instance lock to prevent duplicate conflicting processes
const gotTheSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotTheSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    createSettingsWindow();
  });
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
  createOcrDialogWindow();
  createReplyWindow();
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
  try {
    if (winInputWorker && !winInputWorker.killed) {
      winInputWorker.stdin?.write('EXIT\n');
      winInputWorker.kill();
      winInputWorker = null;
    }
  } catch (e) {}
});

// IPC Handlers
ipcMain.handle('get-settings', () => activeSettings);

ipcMain.handle('save-settings', (_, newSettings: AppSettings) => {
  activeSettings = { ...activeSettings, ...newSettings };
  saveSettingsToDisk(activeSettings);
  applyAutoStartSetting(activeSettings.autoStartWithWindows ?? true);
  registerHotkeys();
  updateTrayMenu();

  // Broadcast settings change to all active renderer windows immediately
  popupWindow?.webContents.send('settings-updated', activeSettings);
  settingsWindow?.webContents.send('settings-updated', activeSettings);
  replyWindow?.webContents.send('settings-updated', activeSettings);
  ocrDialogWindow?.webContents.send('settings-updated', activeSettings);
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
  // Auto-launch via native Windows Shell
  await applyUpdateAndRestart(filePath);
  return true;
});

ipcMain.handle('apply-downloaded-update', async () => {
  return await applyUpdateAndRestart();
});

ipcMain.handle('open-update-folder', () => {
  return openUpdateFolder();
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

  // Window dimensions for split-view Vision Translator (Image left, AI Translation right)
  const targetWinW = Math.max(900, Math.min(maxWidth, Math.round(cropW * 1.1) + 480));
  const targetWinH = Math.max(540, Math.min(maxHeight, Math.round(cropH * 1.1) + 120));

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

  const targetLang = activeSettings.targetLanguage || 'Vietnamese';
  lastVisionSnippet = {
    imagePreview: croppedImageDataUrl,
    targetLanguage: targetLang,
  };

  // Initialize Vision Dialog with original image preview (guarantee delivery even on cold boot)
  const sendInitEvent = () => {
    if (ocrDialogWindow && !ocrDialogWindow.isDestroyed()) {
      ocrDialogWindow.webContents.send('init-vision-translate', {
        imagePreview: croppedImageDataUrl,
        targetLanguage: targetLang,
      });
    }
  };

  if (ocrDialogWindow!.webContents.isLoading()) {
    ocrDialogWindow!.webContents.once('did-finish-load', () => {
      sendInitEvent();
    });
  } else {
    sendInitEvent();
  }

  // Cancel any ongoing vision translation
  if (currentVisionAbortController) {
    currentVisionAbortController.abort();
    currentVisionAbortController = null;
  }

  activeSettings = loadSettings();

  try {
    currentVisionAbortController = await streamVisionTranslation({
      baseUrl: activeSettings.lmStudioUrl,
      model: activeSettings.modelName,
      imageBase64: croppedImageDataUrl,
      targetLanguage: targetLang,
      reasoningEffort: activeSettings.reasoningEffort || 'none',
      systemPromptTemplate: activeSettings.systemPrompt,
      onChunk: (chunk) => {
        ocrDialogWindow?.webContents.send('vision-translate-chunk', chunk);
      },
      onComplete: (fullText) => {
        ocrDialogWindow?.webContents.send('vision-translate-complete', fullText);

        // Save translation to history
        const history = loadHistory();
        saveHistoryToDisk([
          {
            id: Date.now().toString(),
            originalText: '[Image Snipped Translation]',
            translatedText: fullText,
            targetLanguage: targetLang,
            timestamp: Date.now(),
          },
          ...history,
        ]);
      },
      onError: (err) => {
        ocrDialogWindow?.webContents.send('vision-translate-error', err.message || 'Vision translation failed');
      },
    });
  } catch (err: any) {
    ocrDialogWindow?.webContents.send('vision-translate-error', err.message || 'Could not connect to translation service');
  }
});

// IPC handlers for Vision Translation controls (Retry, Language change, Cancel)
ipcMain.on('start-vision-translation', async (event, { imageBase64, targetLang }: { imageBase64: string; targetLang?: string }) => {
  if (currentVisionAbortController) {
    currentVisionAbortController.abort();
    currentVisionAbortController = null;
  }

  activeSettings = loadSettings();
  const lang = targetLang || activeSettings.targetLanguage || 'Vietnamese';

  try {
    currentVisionAbortController = await streamVisionTranslation({
      baseUrl: activeSettings.lmStudioUrl,
      model: activeSettings.modelName,
      imageBase64,
      targetLanguage: lang,
      reasoningEffort: activeSettings.reasoningEffort || 'none',
      systemPromptTemplate: activeSettings.systemPrompt,
      onChunk: (chunk) => {
        event.sender.send('vision-translate-chunk', chunk);
      },
      onComplete: (fullText) => {
        event.sender.send('vision-translate-complete', fullText);

        const history = loadHistory();
        saveHistoryToDisk([
          {
            id: Date.now().toString(),
            originalText: '[Image Snipped Translation]',
            translatedText: fullText,
            targetLanguage: lang,
            timestamp: Date.now(),
          },
          ...history,
        ]);
      },
      onError: (err) => {
        event.sender.send('vision-translate-error', err.message || 'Vision translation failed');
      },
    });
  } catch (err: any) {
    event.sender.send('vision-translate-error', err.message || 'Vision translation failed');
  }
});

ipcMain.on('cancel-vision-translation', () => {
  if (currentVisionAbortController) {
    currentVisionAbortController.abort();
    currentVisionAbortController = null;
  }
});

ipcMain.handle('get-latest-vision-snippet', () => {
  return lastVisionSnippet;
});

ipcMain.on('start-translation', async (event, { text, targetLang }: { text: string; targetLang?: string }) => {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  activeSettings = loadSettings();
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

// Quick Chat Reply & Replace IPC Handlers
ipcMain.on(
  'start-reply-translation',
  async (_, { text, targetLang, tone }: { text: string; targetLang: string; tone: ReplyTone }) => {
    const lang = targetLang || activeSettings.outgoingLanguage || 'Korean';
    const activeTone = tone || activeSettings.outgoingTone || 'polite';
    await startReplyStream(text, lang, activeTone);
  }
);

ipcMain.on('cancel-reply-translation', () => {
  latestReplyRequestId++;
  if (currentReplyAbortController) {
    currentReplyAbortController.abort();
    currentReplyAbortController = null;
  }
});

ipcMain.on(
  'set-reply-preference',
  (_, { targetLang, tone }: { targetLang?: string; tone?: ReplyTone }) => {
    let changed = false;
    if (targetLang && targetLang !== activeSettings.outgoingLanguage) {
      activeSettings.outgoingLanguage = targetLang;
      if (lastReplySnippet) lastReplySnippet.targetLanguage = targetLang;
      changed = true;
    }
    if (tone && tone !== activeSettings.outgoingTone) {
      activeSettings.outgoingTone = tone;
      if (lastReplySnippet) lastReplySnippet.tone = tone;
      changed = true;
    }
    if (changed) {
      saveSettingsToDisk(activeSettings);
      updateTrayMenu();
    }
  }
);

ipcMain.on('confirm-reply-replace', async (_, translatedText: string) => {
  latestReplyRequestId++;
  if (currentReplyAbortController) {
    currentReplyAbortController.abort();
    currentReplyAbortController = null;
  }
  await replaceTextInActiveChat(translatedText);
});

ipcMain.on('close-reply-dialog', () => {
  latestReplyRequestId++;
  if (currentReplyAbortController) {
    currentReplyAbortController.abort();
    currentReplyAbortController = null;
  }
  hideReplyWindow();
});

ipcMain.on('set-reply-pinned', (_, pinned: boolean) => {
  if (replyWindow && !replyWindow.isDestroyed()) {
    (replyWindow as any).isPinned = pinned;
    replyWindow.setAlwaysOnTop(true, pinned ? 'screen-saver' : 'pop-up-menu');
  }
});

ipcMain.handle('get-latest-reply-snippet', () => {
  return lastReplySnippet;
});
