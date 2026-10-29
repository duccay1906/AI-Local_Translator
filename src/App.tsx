import React, { useState, useEffect } from 'react';
import { FloatingPopup } from './components/FloatingPopup';
import { SettingsModal } from './components/SettingsModal';
import { SplashScreen } from './components/SplashScreen';
import { SnipOverlay } from './components/SnipOverlay';
import { OcrDialog } from './components/OcrDialog';

export const App: React.FC = () => {
  const [route, setRoute] = useState<string>(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (route === '#splash') {
    return <SplashScreen />;
  }

  if (route === '#settings') {
    return <SettingsModal />;
  }

  if (route === '#snip') {
    return <SnipOverlay />;
  }

  if (route === '#ocr') {
    return <OcrDialog />;
  }

  return <FloatingPopup />;
};
