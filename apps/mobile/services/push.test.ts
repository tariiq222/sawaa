jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

jest.mock('./notifications', () => ({
  notificationsService: {
    registerFcmToken: jest.fn().mockResolvedValue({ success: true }),
    unregisterFcmToken: jest.fn().mockResolvedValue({ success: true }),
  },
}));

import * as Notifications from 'expo-notifications';

import { notificationsService } from './notifications';
import {
  registerForPushAsync,
  unregisterPushAsync,
  __resetPushStateForTests,
} from './push';

const mockedNotifications = Notifications as unknown as {
  setNotificationHandler: jest.Mock;
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  getDevicePushTokenAsync: jest.Mock;
};

const mockedService = notificationsService as unknown as {
  registerFcmToken: jest.Mock;
  unregisterFcmToken: jest.Mock;
};

beforeEach(() => {
  __resetPushStateForTests();
  mockedNotifications.setNotificationHandler.mockClear();
  mockedNotifications.getPermissionsAsync.mockReset();
  mockedNotifications.requestPermissionsAsync.mockReset();
  mockedNotifications.getDevicePushTokenAsync.mockReset();
  mockedService.registerFcmToken.mockClear();
  mockedService.unregisterFcmToken.mockClear();
});

describe('registerForPushAsync — iOS cannot register an APNs token as FCM', () => {
  it('does not send the raw APNs token to the backend', async () => {
    const { Platform } = jest.requireMock('react-native') as { Platform: { OS: string } };
    Platform.OS = 'ios';
    try {
      mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const result = await registerForPushAsync();

      expect(result).toBeNull();
      expect(mockedNotifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
      expect(mockedService.registerFcmToken).not.toHaveBeenCalled();
    } finally {
      Platform.OS = 'android';
    }
  });
});

describe('registerForPushAsync — happy path', () => {
  it('requests permission, fetches token, calls backend with platform', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockedNotifications.getDevicePushTokenAsync.mockResolvedValue({
      type: 'android',
      data: 'fcm-registration-token',
    });

    const result = await registerForPushAsync();

    expect(result).toBe('fcm-registration-token');
    expect(mockedNotifications.setNotificationHandler).toHaveBeenCalledTimes(1);
    expect(mockedNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockedService.registerFcmToken).toHaveBeenCalledWith(
      'fcm-registration-token',
      'android',
    );

    await unregisterPushAsync();
    expect(mockedService.unregisterFcmToken).toHaveBeenCalledTimes(1);
  });

  it('returns null when permission is denied without calling the backend', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const result = await registerForPushAsync();

    expect(result).toBeNull();
    expect(mockedNotifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
    expect(mockedService.registerFcmToken).not.toHaveBeenCalled();
  });
});
