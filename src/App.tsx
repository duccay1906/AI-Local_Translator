import React, { useState, useEffect } from 'react';
import { FloatingPopup } from './components/FloatingPopup';
import { SettingsModal } from './components/SettingsModal';
import { SplashScreen } from './components/SplashScreen';
import { SnipOverlay } from './components/SnipOverlay';
import { OcrDialog } from './components/OcrDialog';
import { QuickReplyDialog } from './components/QuickReplyDialog';

export const App: React.FC = () => {
  const [route, setRoute] = useState<string>(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (route.startsWith('#splash')) {
    return <SplashScreen />;
  }

  if (route.startsWith('#settings')) {
    return <SettingsModal />;
  }

  if (route.startsWith('#snip')) {
    return <SnipOverlay />;
  }

  if (route.startsWith('#ocr')) {
    return <OcrDialog />;
  }

  if (route.startsWith('#reply')) {
    return <QuickReplyDialog />;
  }

  return <FloatingPopup />;
};
