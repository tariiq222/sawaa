import type { ExpoConfig } from 'expo/config';
import { resolveApiUrl } from './constants/api-url-validation';

// Resolve this during Expo config evaluation so production builds fail before
// a native bundle is created when the API target is missing or unsafe.
resolveApiUrl({
  configuredApiUrl: process.env.EXPO_PUBLIC_API_URL,
  easBuildProfile: process.env.EAS_BUILD_PROFILE,
  nodeEnv: process.env.NODE_ENV,
});

const config: ExpoConfig = {
  name: 'سواء للارشاد الاسري | sawaa',
  slug: 'sawa',
  owner: 'tariq222',
  extra: {
    eas: {
      projectId: 'f6349cef-8426-442c-b249-118a9b512cf1',
    },
  },
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
    appleTeamId: '569M49FYA6',
    supportsTablet: true,
    bundleIdentifier: 'sa.sawa.app',
    ...(process.env.FIREBASE_IOS_GOOGLE_SERVICES_FILE
      ? { googleServicesFile: process.env.FIREBASE_IOS_GOOGLE_SERVICES_FILE }
      : {}),
  },
  android: {
    package: 'sa.sawa.app',
    ...(process.env.FIREBASE_ANDROID_GOOGLE_SERVICES_FILE
      ? { googleServicesFile: process.env.FIREBASE_ANDROID_GOOGLE_SERVICES_FILE }
      : {}),
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
    ['@react-native-firebase/app', { ios: { disableSPM: true } }],
    '@react-native-firebase/messaging',
    ['expo-build-properties', { ios: { useFrameworks: 'static', deploymentTarget: '15.1' } }],
    'expo-image-picker',
    './plugins/with-ios-pod-deployment-target',
    [
      '@sentry/react-native/expo',
      {
        url: process.env.SENTRY_URL || 'https://errors.webvue.pro/',
        organization: 'webvue',
        project: 'sawaa-mobile',
      },
    ],
  ],
};

export default config;
