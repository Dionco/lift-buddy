import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dionco.liftbuddy',
  appName: 'Lift Buddy',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
  },
};

export default config;
