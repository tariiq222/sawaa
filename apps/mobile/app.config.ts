import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'سواء للإرشاد الأسري',
  slug: 'sawa',
  version: '1.0.0',
  scheme: 'sawa',
  orientation: 'portrait',
  icon: './assets/sawa/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/sawa/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'sa.sawa.app',
  },
  android: {
    package: 'sa.sawa.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/sawa/android-icon-foreground.png',
      backgroundImage: './assets/sawa/android-icon-background.png',
      monochromeImage: './assets/sawa/android-icon-monochrome.png',
    },
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-notifications',
    'expo-image-picker',
    [
      '@sentry/react-native/expo',
      {
        url: 'http://100.124.231.44:8000/',
        organization: 'webvue',
        project: 'deqah-mobile',
      },
    ],
  ],
};

export default config;
