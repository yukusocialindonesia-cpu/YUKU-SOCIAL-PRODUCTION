import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Provisional application ID; confirm before the first public store release.
  appId: 'id.yuku.app',
  appName: 'YUKU',
  webDir: 'dist',
  backgroundColor: '#FAF8FC',
  android: { allowMixedContent: false },
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
