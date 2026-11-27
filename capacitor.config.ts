import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Confirmed application ID for Android and iOS.
  appId: 'yuku.app',
  appName: 'YUKU',
  webDir: 'dist',
  backgroundColor: '#FAF8FC',
  android: {
    allowMixedContent: false,
  },
  ios: { contentInset: 'automatic' },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#FAF8FC',
      showSpinner: false,
    },
  },
};

export default config;
