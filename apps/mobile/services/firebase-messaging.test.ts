jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { appOwnership: 'standalone' } }));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => 'messaging-instance'),
  registerDeviceForRemoteMessages: jest.fn().mockResolvedValue(undefined),
  getToken: jest.fn().mockResolvedValue('fcm-from-firebase'),
  onTokenRefresh: jest.fn(),
}));

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Messaging from '@react-native-firebase/messaging';
import { getFcmToken, subscribeToFcmTokenRefresh } from './firebase-messaging';

const native = Messaging as jest.Mocked<typeof Messaging>;

beforeEach(() => {
  Platform.OS = 'ios';
  (Constants as { appOwnership: string }).appOwnership = 'standalone';
  native.getToken.mockClear();
  native.getMessaging.mockClear();
  native.registerDeviceForRemoteMessages.mockClear();
  native.onTokenRefresh.mockClear();
});

it('registers with APNs then reads the Firebase FCM token on iOS', async () => {
  expect(await getFcmToken()).toBe('fcm-from-firebase');
  expect(native.registerDeviceForRemoteMessages).toHaveBeenCalledWith('messaging-instance');
  expect(native.getToken).toHaveBeenCalledWith('messaging-instance');
});

it('reads Firebase FCM on Android without APNs registration', async () => {
  Platform.OS = 'android';
  expect(await getFcmToken()).toBe('fcm-from-firebase');
  expect(native.registerDeviceForRemoteMessages).not.toHaveBeenCalled();
});

it('skips Expo Go and web without opening the native module', async () => {
  (Constants as { appOwnership: string }).appOwnership = 'expo';
  expect(await getFcmToken()).toBeNull();
  expect(subscribeToFcmTokenRefresh(jest.fn())).toEqual(expect.any(Function));
  expect(native.getMessaging).not.toHaveBeenCalled();

  (Constants as { appOwnership: string }).appOwnership = 'standalone';
  Platform.OS = 'web';
  expect(await getFcmToken()).toBeNull();
  expect(native.getMessaging).not.toHaveBeenCalled();
});

it('returns an unsubscribe callback for native token changes', () => {
  const unsubscribe = jest.fn();
  const listener = jest.fn();
  native.onTokenRefresh.mockReturnValue(unsubscribe);

  expect(subscribeToFcmTokenRefresh(listener)).toBe(unsubscribe);
  expect(native.onTokenRefresh).toHaveBeenCalledWith('messaging-instance', listener);
});

it('returns null when Firebase cannot supply a token', async () => {
  native.getToken.mockRejectedValueOnce(new Error('missing native configuration'));
  expect(await getFcmToken()).toBeNull();
});

it('does not crash when the native messaging instance is missing', async () => {
  native.getMessaging.mockImplementationOnce(() => {
    throw new Error('native module unavailable');
  });
  expect(await getFcmToken()).toBeNull();

  native.getMessaging.mockImplementationOnce(() => {
    throw new Error('native module unavailable');
  });
  expect(subscribeToFcmTokenRefresh(jest.fn())).toEqual(expect.any(Function));
});
