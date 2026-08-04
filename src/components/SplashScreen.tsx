import React from 'react';
import { Sparkles } from 'lucide-react';

export const SplashScreen: React.FC = () => {
  return (
    <div 
      className="glass-panel" 
      style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'rgba(11, 15, 25, 0.92)',
        padding: '24px',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(99, 102, 241, 0.25)'
      }}
    >
      <div 
        style={{ 
          width: '52px', 
          height: '52px', 
          borderRadius: '16px', 
          background: 'var(--accent-gradient)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)',
          marginBottom: '16px'
        }}
      >
        <Sparkles size={28} color="#fff" />
      </div>

      <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }} className="gradient-text">
        AI Local Translator
      </h1>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
        Initializing AI engine & global hooks...
      </p>

      {/* Animated Loading Bar */}
      <div 
        style={{ 
          width: '80%', 
          height: '4px', 
          background: 'rgba(255,255,255,0.1)', 
          borderRadius: '4px',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div 
          style={{ 
            width: '45%', 
            height: '100%', 
            background: 'var(--accent-gradient)',
            borderRadius: '4px',
            position: 'absolute',
            animation: 'splash-progress 1.5s infinite ease-in-out'
          }} 
        />
      </div>

      <style>{`
        @keyframes splash-progress {
          0% { left: -45%; width: 30%; }
          50% { left: 30%; width: 55%; }
          100% { left: 100%; width: 30%; }
        }
      `}</style>
    </div>
  );
};
