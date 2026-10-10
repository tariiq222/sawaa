import type { ExpoConfig } from 'expo/config';
import { resolveApiUrl, resolveIosBuildNumber } from './constants/api-url-validation';

// Resolve this during Expo config evaluation so production builds fail before
// a native bundle is created when the API target is missing or unsafe.
const apiUrl = resolveApiUrl({
  configuredApiUrl: process.env.EXPO_PUBLIC_API_URL,
  easBuildProfile: process.env.EXPO_PUBLIC_RELEASE_ENVIRONMENT || process.env.EAS_BUILD_PROFILE,
  nodeEnv: process.env.NODE_ENV,
});

const applePayMerchantId = process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID || undefined;
const iosBuildNumber = resolveIosBuildNumber(process.env.IOS_BUILD_NUMBER);
if (applePayMerchantId && !/^merchant\.[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*$/.test(applePayMerchantId)) {
  throw new Error('Invalid EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID');
}

const config: ExpoConfig = {
  name: 'سواء للارشاد الاسري | sawaa',
  slug: 'sawa',
  owner: 'tariq222',
  extra: {
    applePayMerchantId,
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
    backgroundColor: '#14a89a',
  },
  ios: {
    ...(iosBuildNumber ? { buildNumber: iosBuildNumber } : {}),
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      ...(process.env.GITHUB_SHA ? { SawaaSourceSha: process.env.GITHUB_SHA } : {}),
      ...(process.env.EXPO_PUBLIC_RELEASE_ENVIRONMENT
        ? { SawaaReleaseEnvironment: process.env.EXPO_PUBLIC_RELEASE_ENVIRONMENT, SawaaApiUrl: apiUrl }
        : {}),
    },
    appleTeamId: '569M49FYA6',
    ...(applePayMerchantId ? { entitlements: { 'com.apple.developer.in-app-payments': [applePayMerchantId] } } : {}),
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
    './plugins/with-ios-splash-background',
    './plugins/with-ios-scene-lifecycle',
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
