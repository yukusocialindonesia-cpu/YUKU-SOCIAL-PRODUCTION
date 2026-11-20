import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // Log safe VAPID diagnostics only; never print the key itself.
  const vapidKey = process.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim() ?? '';
  let vapidDecodedLength = 0;
  let vapidFirstByte = 'missing';
  if (vapidKey) {
    try {
      const normalized = vapidKey.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      const decoded = Buffer.from(padded, 'base64');
      vapidDecodedLength = decoded.length;
      vapidFirstByte = decoded.length ? decoded[0].toString(16).padStart(2, '0') : 'empty';
    } catch {
      vapidFirstByte = 'decode-error';
    }
  }
  console.log('[YUKU] Web Push VAPID diagnostics:', {
    configured: Boolean(vapidKey),
    characters: vapidKey.length,
    decodedBytes: vapidDecodedLength,
    firstByte: vapidFirstByte,
  });
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
