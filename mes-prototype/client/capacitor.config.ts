import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.navigatorbead.mes',
  appName: 'Navigator Bead for Life MES',
  webDir: 'dist',
  server: {
    // Helps Android load local dev server when needed (optional).
    androidScheme: 'https',
  },
};

export default config;
