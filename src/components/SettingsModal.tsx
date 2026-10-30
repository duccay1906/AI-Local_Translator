import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AppSettings, TranslationHistoryItem, ReasoningEffort, UpdateCheckResult } from '../types';
import { 
  Server, 
  Cpu, 
  Globe, 
  Keyboard, 
  Sliders, 
  History, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Trash2,
  Copy,
  Check,
  Eye,
  ScanText,
  Download,
  ArrowUpCircle
} from 'lucide-react';
import { OCR_LANGUAGE_OPTIONS } from './SnipOverlay';

const HotkeyRecorder: React.FC<{ value: string; onChange: (shortcut: string) => void }> = ({ value, onChange }) => {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const key = e.key;
      if (key === 'Escape') {
        setIsRecording(false);
        return;
      }

      // Ignore standalone modifier keys
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');

      let mainKey = key.toUpperCase();
      if (/^f\d{1,2}$/i.test(key)) {
        mainKey = key.toUpperCase();
      } else if (key === ' ') {
        mainKey = 'Space';
      } else if (key.length === 1) {
        mainKey = key.toUpperCase();
      } else {
        mainKey = key.charAt(0).toUpperCase() + key.slice(1);
      }

      parts.push(mainKey);
      const newShortcut = parts.join('+');
      onChange(newShortcut);
      setIsRecording(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isRecording, onChange]);

  return (
    <div style={{ position: 'relative' }}>
      {isRecording ? (
        <div
          onClick={() => setIsRecording(false)}
          style={{
            background: 'rgba(99, 102, 241, 0.25)',
            border: '2px dashed var(--accent-primary)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            fontSize: '12px',
            color: '#fff',
            cursor: 'pointer',
            textAlign: 'center',
            outline: 'none',
            boxShadow: '0 0 16px rgba(99, 102, 241, 0.5)',
          }}
        >
          ⌨️ Press any key combo (e.g. F8, Ctrl+Shift+X)... <span style={{ color: 'var(--text-muted)' }}>(Esc to cancel)</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsRecording(true)}
          className="form-input font-mono"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            background: 'rgba(11, 15, 25, 0.7)',
            padding: '6px 10px',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {value ? (
              value.split('+').map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span style={{ color: 'var(--text-muted)' }}>+</span>}
                  <kbd
                    style={{
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid var(--accent-primary)',
                      color: '#fff',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {part}
                  </kbd>
                </React.Fragment>
              ))
            ) : (
              <span style={{ color: 'var(--text-dim)' }}>Click to record key</span>
            )}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--accent-primary)' }}>Press to change hotkey</span>
        </button>
      )}
    </div>
  );
};

export const SettingsModal: React.FC = () => {
  const getInitialTab = (): 'general' | 'prompt' | 'updates' | 'history' => {
    const hash = window.location.hash || '';
    if (hash.includes('tab=updates') || hash.includes('#updates')) return 'updates';
    if (hash.includes('tab=prompt') || hash.includes('#prompt')) return 'prompt';
    if (hash.includes('tab=history') || hash.includes('#history')) return 'history';
    return 'general';
  };

  const [activeTab, setActiveTab] = useState<'general' | 'prompt' | 'updates' | 'history'>(getInitialTab);
  const [settings, setSettings] = useState<AppSettings>({
    lmStudioUrl: 'http://192.168.1.6:1234',
    modelName: 'local-model',
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
    updateServerUrl: 'http://192.168.1.12:8080/updates',
    autoCheckUpdate: true,
  });

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [historyItems, setHistoryItems] = useState<TranslationHistoryItem[]>([]);
  const [searchHistory, setSearchHistory] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-Update States
  const [appVersion, setAppVersion] = useState<string>('1.0.8');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial settings, version and history
    api.getSettings().then((s) => {
      setSettings(s);
      loadModels(s.lmStudioUrl);
    });

    api.getAppVersion().then((ver) => {
      if (ver) setAppVersion(ver);
    });

    api.getHistory().then((h) => {
      setHistoryItems(h);
    });

    // Listen to update download progress
    const unsubscribeProgress = api.onUpdateDownloadProgress((pct) => {
      setDownloadProgress(pct);
    });

    // Listen to tab switch request
    const unsubscribeTabSwitch = api.onSwitchSettingsTab((tab) => {
      if (['general', 'prompt', 'updates', 'history'].includes(tab)) {
        setActiveTab(tab as any);
      }
    });

    const handleWindowFocus = () => {
      api.getSettings().then((s) => {
        setSettings((prev) => ({
          ...prev,
          outgoingLanguage: s.outgoingLanguage || prev.outgoingLanguage,
          outgoingTone: s.outgoingTone || prev.outgoingTone,
          ocrLanguage: s.ocrLanguage || prev.ocrLanguage,
        }));
      });
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      unsubscribeProgress();
      unsubscribeTabSwitch();
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const handleCheckUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateError(null);
    try {
      // Save settings first in case URL changed
      await api.saveSettings(settings);
      const res = await api.checkForUpdates();
      setUpdateResult(res);
      if (res.error) {
        setUpdateError(res.error);
      }
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to check for updates');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadAndApply = async () => {
    if (!updateResult?.updateInfo?.downloadUrl) return;
    setIsDownloadingUpdate(true);
    setDownloadProgress(0);
    setUpdateError(null);
    try {
      await api.downloadAndApplyUpdate(updateResult.updateInfo.downloadUrl);
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to download or apply update');
      setIsDownloadingUpdate(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      api.getHistory().then((h) => {
        setHistoryItems(h);
      });
    }
  }, [activeTab]);

  const loadModels = async (baseUrl: string) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const models = await api.fetchModels(baseUrl);
      setAvailableModels(models);
      setTestResult({
        success: true,
        message: 'Successfully connected to LM Studio Server.',
      });
      if (models.length > 0 && (!settings.modelName || settings.modelName === 'local-model')) {
        setSettings((prev) => ({ ...prev, modelName: models[0] }));
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to connect to LM Studio.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    await api.saveSettings(settings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear translation history?')) {
      await api.clearHistory();
      setHistoryItems([]);
    }
  };

  const handleCopyHistory = (text: string, id: string) => {
    api.copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredHistory = historyItems.filter(
    (item) =>
      item.originalText.toLowerCase().includes(searchHistory.toLowerCase()) ||
      item.translatedText.toLowerCase().includes(searchHistory.toLowerCase())
  );

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column' }}>
      {/* Settings Top Header */}
      <div 
        style={{ 
          padding: '16px 24px', 
          borderBottom: '1px solid var(--glass-border)',
          background: 'rgba(18, 24, 38, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }} className="gradient-text">
            AI Local Translator Configuration
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Configure LM Studio connection, shortcuts, language preferences, and prompt rules.
          </p>
        </div>

        {/* Action Save Button */}
        <button className="btn-primary" onClick={handleSaveSettings}>
          {savedSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {savedSuccess ? 'Saved Successfully!' : 'Save Settings'}
        </button>
      </div>

      {/* Main Settings Tabs */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar Nav */}
        <div 
          style={{ 
            width: '200px', 
            background: 'rgba(11, 15, 25, 0.6)', 
            borderRight: '1px solid var(--glass-border)',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <button 
            className={`btn-icon ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
            style={{ width: '100%', height: '40px', justifyContent: 'flex-start', padding: '0 12px', gap: '10px' }}
          >
            <Sliders size={16} /> General & Model
          </button>

          <button 
            className={`btn-icon ${activeTab === 'prompt' ? 'active' : ''}`}
            onClick={() => setActiveTab('prompt')}
            style={{ width: '100%', height: '40px', justifyContent: 'flex-start', padding: '0 12px', gap: '10px' }}
          >
            <Globe size={16} /> System Prompt
          </button>

          <button 
            className={`btn-icon ${activeTab === 'updates' ? 'active' : ''}`}
            onClick={() => setActiveTab('updates')}
            style={{ width: '100%', height: '40px', justifyContent: 'flex-start', padding: '0 12px', gap: '10px' }}
          >
            <ArrowUpCircle size={16} /> Software Updates
          </button>

          <button 
            className={`btn-icon ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            style={{ width: '100%', height: '40px', justifyContent: 'flex-start', padding: '0 12px', gap: '10px' }}
          >
            <History size={16} /> Translation History
          </button>
        </div>

        {/* Tab Content Area */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '560px' }}>
              {/* LM Studio Connection Box */}
              <div className="glass-panel" style={{ padding: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Server size={16} color="var(--accent-primary)" /> LM Studio Server Endpoint
                </h3>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={settings.lmStudioUrl}
                    onChange={(e) => setSettings({ ...settings, lmStudioUrl: e.target.value })}
                    placeholder="http://localhost:1234"
                  />
                  <button 
                    className="btn-primary" 
                    onClick={() => loadModels(settings.lmStudioUrl)}
                    disabled={isTesting}
                    style={{ flexShrink: 0, padding: '0 12px', fontSize: '12px' }}
                  >
                    <RefreshCw size={14} className={isTesting ? 'spin' : ''} /> Test Connection
                  </button>
                </div>

                {testResult && (
                  <div 
                    style={{ 
                      padding: '8px 12px', 
                      borderRadius: 'var(--radius-md)', 
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                      background: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: testResult.success ? '#34d399' : '#fca5a5',
                      border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                    }}
                  >
                    {testResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    {testResult.message}
                  </div>
                )}

                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Cpu size={14} color="var(--accent-primary)" /> AI Thinking / Reasoning Mode (Gemma 4 / DeepSeek / Qwen):
                  </label>
                  <select
                    className="form-select"
                    value={settings.reasoningEffort || 'none'}
                    onChange={(e) => setSettings({ ...settings, reasoningEffort: e.target.value as ReasoningEffort })}
                  >
                    <option value="none">None — Instant Translation (~0.3s, No Thinking Delay) [Recommended]</option>
                    <option value="low">Low — Light Reasoning</option>
                    <option value="medium">Medium — Balanced Reasoning</option>
                    <option value="high">High — Deep Thinking (Slower, 10–15s)</option>
                  </select>
                </div>
              </div>

              {/* Hotkey & Preferences */}
              <div className="glass-panel" style={{ padding: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Keyboard size={16} color="#ec4899" /> Global Hotkeys & Languages
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Text Translate Hotkey (Selection):
                    </label>
                    <HotkeyRecorder 
                      value={settings.hotkey || 'F8'} 
                      onChange={(newShortcut) => setSettings({ ...settings, hotkey: newShortcut })} 
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Copy & translate selected text</span>
                      {(settings.hotkey && settings.hotkey !== 'F8') && (
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, hotkey: 'F8' })}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Reset to F8
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Image OCR Hotkey (Screen Snip):
                    </label>
                    <HotkeyRecorder 
                      value={settings.ocrHotkey || 'F9'} 
                      onChange={(newShortcut) => setSettings({ ...settings, ocrHotkey: newShortcut })} 
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Drag area to translate image</span>
                      {(settings.ocrHotkey && settings.ocrHotkey !== 'F9') && (
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, ocrHotkey: 'F9' })}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Reset to F9
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Quick Chat Reply & Replace Hotkey:
                    </label>
                    <HotkeyRecorder 
                      value={settings.replyHotkey || 'F10'} 
                      onChange={(newShortcut) => setSettings({ ...settings, replyHotkey: newShortcut })} 
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Translate chat input & replace on Enter</span>
                      {(settings.replyHotkey && settings.replyHotkey !== 'F10') && (
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, replyHotkey: 'F10' })}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Reset to F10
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Outgoing Chat Language (Reply To):
                    </label>
                    <select 
                      className="form-select"
                      value={settings.outgoingLanguage || 'Korean'}
                      onChange={(e) => setSettings({ ...settings, outgoingLanguage: e.target.value })}
                    >
                      <option value="Korean">Korean (한국어)</option>
                      <option value="English">English</option>
                      <option value="Japanese">Japanese (日本語)</option>
                      <option value="Chinese (Simplified)">Chinese (中文)</option>
                      <option value="Vietnamese">Vietnamese (Tiếng Việt)</option>
                      <option value="French">French (Français)</option>
                      <option value="German">German (Deutsch)</option>
                      <option value="Spanish">Spanish (Español)</option>
                    </select>
                    <div style={{ marginTop: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Default target language when using F10 Reply</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Default Reading Language (F8 / F9):
                    </label>
                    <select 
                      className="form-select"
                      value={settings.targetLanguage}
                      onChange={(e) => setSettings({ ...settings, targetLanguage: e.target.value })}
                    >
                      <option value="Vietnamese">Vietnamese (Tiếng Việt)</option>
                      <option value="English">English</option>
                      <option value="Japanese">Japanese (日本語)</option>
                      <option value="Korean">Korean (한국어)</option>
                      <option value="Chinese (Simplified)">Chinese (中文)</option>
                      <option value="French">French (Français)</option>
                      <option value="German">German (Deutsch)</option>
                      <option value="Spanish">Spanish (Español)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                      <ScanText size={13} color="var(--accent-primary)" /> OCR Source Language (In Image):
                    </label>
                    <select 
                      className="form-select"
                      value={(settings.ocrLanguage && settings.ocrLanguage !== 'eng+jpn+kor+chi_sim') ? settings.ocrLanguage : 'auto'}
                      onChange={(e) => setSettings({ ...settings, ocrLanguage: e.target.value })}
                    >
                      {OCR_LANGUAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Window Opacity Preference */}
              <div className="glass-panel" style={{ padding: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Eye size={16} color="var(--accent-primary)" /> Translation Popup Opacity
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input 
                    type="range" 
                    min="0.30" 
                    max="1.0" 
                    step="0.05" 
                    value={settings.opacity ?? 0.92}
                    onChange={(e) => setSettings({ ...settings, opacity: parseFloat(e.target.value) })}
                    style={{ flex: 1, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600, width: '45px', textAlign: 'right' }}>
                    {Math.round((settings.opacity ?? 0.92) * 100)}%
                  </span>
                </div>

                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {(settings.opacity ?? 0.92) >= 0.99 ? '100% Solid Opaque (No transparency or blur effect)' : 'Semi-transparent with Glassmorphism blur'}
                </p>

                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                      🚀 Start Automatically with Windows
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Launch AI Local Translator in System Tray automatically when Windows boots.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoStartWithWindows ?? true}
                    onChange={(e) => setSettings({ ...settings, autoStartWithWindows: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prompt' && (
            <div style={{ maxWidth: '560px' }}>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                  System Prompt Template
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Customize instructions sent to the LLM. Use <code style={{ background: '#1e293b', padding: '2px 4px', borderRadius: '4px' }}>{"{targetLanguage}"}</code> as a dynamic placeholder.
                </p>

                <textarea 
                  className="form-input font-mono" 
                  rows={8}
                  value={settings.systemPrompt}
                  onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                  style={{ resize: 'vertical', lineHeight: '1.4' }}
                />

                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn-icon" 
                    style={{ width: 'auto', padding: '0 10px', fontSize: '11px' }}
                    onClick={() => setSettings({
                      ...settings,
                      systemPrompt: 'You are a professional translator. Translate the given text into {targetLanguage}. Output ONLY the translated text without extra explanation.'
                    })}
                  >
                    Reset Standard Prompt
                  </button>
                  <button 
                    className="btn-icon" 
                    style={{ width: 'auto', padding: '0 10px', fontSize: '11px' }}
                    onClick={() => setSettings({
                      ...settings,
                      systemPrompt: 'You are an expert bilingual dictionary. Translate the text to {targetLanguage}. Provide the primary translation followed by phonetic pronunciation and brief contextual examples.'
                    })}
                  >
                    Set Dictionary Lookup Prompt
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'updates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
              {/* Version & Status Card */}
              <div className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ArrowUpCircle size={18} color="var(--accent-primary)" /> Application Updates
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Current Version: <strong style={{ color: '#fff' }}>v{appVersion}</strong>
                    </p>
                  </div>

                  <button
                    className="btn-secondary"
                    onClick={handleCheckUpdates}
                    disabled={isCheckingUpdate || isDownloadingUpdate}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
                  >
                    <RefreshCw size={14} className={isCheckingUpdate ? 'spin-animation' : ''} />
                    {isCheckingUpdate ? 'Checking LAN...' : 'Check for Updates'}
                  </button>
                </div>
              </div>

              {/* LAN Update Server Configuration */}
              <div className="glass-panel" style={{ padding: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
                  Internal LAN Update Server
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Point clients to the internal server hosting version manifests and binary updates.
                </p>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Server URL (e.g., http://192.168.1.12:8080/updates):
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.updateServerUrl || ''}
                    placeholder="http://192.168.1.12:8080/updates"
                    onChange={(e) => setSettings({ ...settings, updateServerUrl: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="autoCheckUpdate"
                    checked={settings.autoCheckUpdate !== false}
                    onChange={(e) => setSettings({ ...settings, autoCheckUpdate: e.target.checked })}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                  />
                  <label htmlFor="autoCheckUpdate" style={{ fontSize: '12px', color: 'var(--text-main)', cursor: 'pointer' }}>
                    Automatically check for updates on startup
                  </label>
                </div>
              </div>

              {/* Error Alert */}
              {updateError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#fca5a5',
                    fontSize: '12px',
                  }}
                >
                  <XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                  <div>{updateError}</div>
                </div>
              )}

              {/* Update Available Box */}
              {updateResult?.hasUpdate && updateResult.updateInfo && (
                <div
                  className="glass-panel"
                  style={{
                    padding: '18px',
                    border: '1px solid rgba(99, 102, 241, 0.5)',
                    background: 'rgba(99, 102, 241, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          color: 'var(--accent-primary)',
                        }}
                      >
                        New Version Ready
                      </span>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                        🎉 Version {updateResult.updateInfo.version} Available
                      </h4>
                      {updateResult.updateInfo.releaseDate && (
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          Released on {updateResult.updateInfo.releaseDate}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Release Notes */}
                  {updateResult.updateInfo.releaseNotes && (
                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px',
                        fontSize: '12px',
                        color: 'var(--text-main)',
                        whiteSpace: 'pre-wrap',
                        marginBottom: '16px',
                        border: '1px solid var(--glass-border)',
                        maxHeight: '160px',
                        overflowY: 'auto',
                      }}
                    >
                      {updateResult.updateInfo.releaseNotes}
                    </div>
                  )}

                  {/* Downloading Progress */}
                  {isDownloadingUpdate ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                        <span>Downloading update from LAN server...</span>
                        <strong style={{ color: 'var(--accent-primary)' }}>{downloadProgress}%</strong>
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: '8px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${downloadProgress}%`,
                            height: '100%',
                            background: 'var(--accent-primary)',
                            transition: 'width 0.2s ease',
                          }}
                        />
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' }}>
                        App will automatically restart and launch the new version once download completes.
                      </p>
                    </div>
                  ) : (
                    <button
                      className="btn-primary"
                      onClick={handleDownloadAndApply}
                      style={{ width: '100%', height: '38px', justifyContent: 'center', gap: '8px', fontSize: '13px' }}
                    >
                      <Download size={16} /> Download & Update Now
                    </button>
                  )}
                </div>
              )}

              {/* Already Up-To-Date Result */}
              {updateResult && !updateResult.hasUpdate && !updateResult.error && (
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#6ee7b7',
                    fontSize: '12px',
                  }}
                >
                  <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
                  <div>
                    <strong>You are on the latest version!</strong>
                    <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '2px' }}>
                      Version v{appVersion} is currently the newest release available on your LAN server.
                    </div>
                  </div>
                </div>
              )}

              {/* Helpful instructions footer */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed var(--glass-border)',
                  fontSize: '11px',
                  color: 'var(--text-dim)',
                  lineHeight: '1.6',
                }}
              >
                💡 <strong>Admin Notice:</strong> To push updates across the network, run{' '}
                <code style={{ color: 'var(--accent-primary)' }}>npm run updates:serve</code> on your host server (e.g. 192.168.1.12). All client machines will detect and offer updates on launch.
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Search history..."
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  style={{ width: '240px' }}
                />
                
                <button className="btn-icon" onClick={handleClearHistory} title="Clear All History">
                  <Trash2 size={15} color="#ef4444" />
                </button>
              </div>

              {filteredHistory.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                  No translation history found.
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div key={item.id} className="glass-panel" style={{ padding: '12px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>→ {item.targetLanguage}</span>
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                    </div>

                    <div style={{ color: 'var(--text-muted)', marginBottom: '6px', fontStyle: 'italic' }}>
                      "{item.originalText}"
                    </div>

                    <div style={{ color: 'var(--text-main)', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>{item.translatedText}</div>
                      <button 
                        className="btn-icon" 
                        onClick={() => handleCopyHistory(item.translatedText, item.id)}
                        style={{ width: '24px', height: '24px', flexShrink: 0, marginLeft: '8px' }}
                      >
                        {copiedId === item.id ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
