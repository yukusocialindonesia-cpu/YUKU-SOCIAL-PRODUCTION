import { Capacitor } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

// Register the service worker on HTTPS so supported browsers can receive Web Push.
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
