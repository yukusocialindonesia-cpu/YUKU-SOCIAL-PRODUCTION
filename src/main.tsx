import { Capacitor } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

// Native builds use Capacitor plugins for native capabilities and push.
// Keep the existing service worker for supported web/PWA browsers only.
if (!Capacitor.isNativePlatform() && typeof window !== 'undefined' && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('YUKU: service worker belum dapat didaftarkan.', error);
    });
  }, { once: true });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root tidak ditemukan');
}

createRoot(rootElement).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
