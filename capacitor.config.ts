import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ccbcultos.integrado',
  appName: 'Cultos CCB',
  webDir: 'www',
  server: {
    url: 'https://preview--culto-insight-hub.lovable.app',
    cleartext: false
  }
};

export default config;
