jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

jest.mock('expo-device', () => ({ isDevice: true }));

let mockEpoch = 0;
jest.mock('./native-session-state', () => ({
  getSessionEpoch: () => mockEpoch,
  isSessionCurrent: (epoch: number) => epoch === mockEpoch,
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

jest.mock('./firebase-messaging', () => ({
  getFcmToken: jest.fn(),
  subscribeToFcmTokenRefresh: jest.fn(),
}));

jest.mock('./notifications', () => ({
  notificationsService: {
    registerFcmToken: jest.fn().mockResolvedValue({ success: true }),
    unregisterFcmToken: jest.fn().mockResolvedValue({ success: true }),
  },
}));

import * as Notifications from 'expo-notifications';

import { notificationsService } from './notifications';
import { getFcmToken, subscribeToFcmTokenRefresh } from './firebase-messaging';
import {
  registerForPushAsync,
  subscribeToFcmTokenRefresh as subscribeToPushTokenRefresh,
  unregisterPushAsync,
  __resetPushStateForTests,
} from './push';

const mockedNotifications = Notifications as unknown as {
  setNotificationHandler: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  getDevicePushTokenAsync: jest.Mock;
};

const mockedService = notificationsService as unknown as {
  registerFcmToken: jest.Mock;
  unregisterFcmToken: jest.Mock;
};
const mockedFirebase = {
  getFcmToken: getFcmToken as jest.Mock,
  subscribeToFcmTokenRefresh: subscribeToFcmTokenRefresh as jest.Mock,
};

beforeEach(() => {
  mockEpoch = 0;
  __resetPushStateForTests();
  mockedNotifications.setNotificationHandler.mockClear();
  mockedNotifications.setNotificationChannelAsync.mockClear();
  mockedNotifications.getPermissionsAsync.mockReset();
  mockedNotifications.requestPermissionsAsync.mockReset();
  mockedNotifications.getDevicePushTokenAsync.mockReset();
  mockedService.registerFcmToken.mockClear();
  mockedService.unregisterFcmToken.mockClear();
  mockedFirebase.getFcmToken.mockReset();
  mockedFirebase.subscribeToFcmTokenRefresh.mockReset();
});

describe('registerForPushAsync — FCM token source', () => {
  it('registers a real FCM token on iOS without reading APNs or Expo tokens', async () => {
    const { Platform } = jest.requireMock('react-native') as { Platform: { OS: string } };
    Platform.OS = 'ios';
    try {
      mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockedFirebase.getFcmToken.mockResolvedValue('ios-fcm-token');

      const result = await registerForPushAsync();

      expect(result).toBe('ios-fcm-token');
      expect(mockedNotifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
      expect(mockedService.registerFcmToken).toHaveBeenCalledWith('ios-fcm-token', 'ios');
    } finally {
      Platform.OS = 'android';
    }
  });
});

describe('registerForPushAsync — happy path', () => {
  it('creates the Android notification channel before prompting for permission', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    expect(await registerForPushAsync()).toBeNull();
    expect(mockedNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ importance: 5 }),
    );
    expect(mockedNotifications.setNotificationChannelAsync.mock.invocationCallOrder[0])
      .toBeLessThan(mockedNotifications.requestPermissionsAsync.mock.invocationCallOrder[0]);
  });

  it('requests permission, fetches token, calls backend with platform', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockedFirebase.getFcmToken.mockResolvedValue('fcm-registration-token');

    const result = await registerForPushAsync();

    expect(result).toBe('fcm-registration-token');
    expect(mockedNotifications.setNotificationHandler).toHaveBeenCalledTimes(1);
    expect(mockedNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockedService.registerFcmToken).toHaveBeenCalledWith(
      'fcm-registration-token',
      'android',
    );
    expect(mockedNotifications.getDevicePushTokenAsync).not.toHaveBeenCalled();

    await unregisterPushAsync();
    expect(mockedService.unregisterFcmToken).toHaveBeenCalledWith('fcm-registration-token');
  });

  it('returns null when permission is denied without calling the backend', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const result = await registerForPushAsync();

    expect(result).toBeNull();
    expect(mockedNotifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
    expect(mockedService.registerFcmToken).not.toHaveBeenCalled();
  });

  it('does not register when the session changes while permission is pending', async () => {
    let current = true;
    mockedNotifications.getPermissionsAsync.mockImplementation(async () => {
      current = false;
      return { status: 'granted' };
    });

    expect(await registerForPushAsync(() => current)).toBeNull();
    expect(mockedFirebase.getFcmToken).not.toHaveBeenCalled();
    expect(mockedService.registerFcmToken).not.toHaveBeenCalled();
  });

  it('returns null when permission or native token lookup fails', async () => {
    mockedNotifications.getPermissionsAsync.mockRejectedValueOnce(new Error('permission unavailable'));
    expect(await registerForPushAsync()).toBeNull();

    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockedFirebase.getFcmToken.mockRejectedValue(new Error('native unavailable'));
    expect(await registerForPushAsync()).toBeNull();
    expect(mockedService.registerFcmToken).not.toHaveBeenCalled();
  });

  it('does not claim a token if the session changes while backend registration is pending', async () => {
    let current = true;
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockedFirebase.getFcmToken.mockResolvedValue('stale-fcm-token');
    mockedService.registerFcmToken.mockImplementationOnce(async () => {
      current = false;
    });

    expect(await registerForPushAsync(() => current)).toBeNull();
    expect(mockedService.unregisterFcmToken).not.toHaveBeenCalled();
    await unregisterPushAsync();
    expect(mockedService.unregisterFcmToken).toHaveBeenCalledWith('stale-fcm-token');
  });

  it('uses the native session epoch even without a caller predicate', async () => {
    mockedNotifications.getPermissionsAsync.mockImplementation(async () => {
      mockEpoch++;
      return { status: 'granted' };
    });

    expect(await registerForPushAsync()).toBeNull();
    expect(mockedFirebase.getFcmToken).not.toHaveBeenCalled();
  });

  it('invalidates a pending registration when unregister runs', async () => {
    let resolveRegistration: (() => void) | undefined;
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockedFirebase.getFcmToken.mockResolvedValue('pending-token');
    mockedService.registerFcmToken.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveRegistration = resolve;
    }));

    const pending = registerForPushAsync();
    await new Promise(process.nextTick);
    const unregistering = unregisterPushAsync();
    expect(mockedService.unregisterFcmToken).not.toHaveBeenCalled();
    resolveRegistration?.();

    expect(await pending).toBeNull();
    await unregistering;
    expect(mockedService.unregisterFcmToken).toHaveBeenCalledWith('pending-token');
  });

  it('does not let an older registration overwrite a newer token', async () => {
    let resolveOld: (() => void) | undefined;
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockedFirebase.getFcmToken
      .mockResolvedValueOnce('old-token')
      .mockResolvedValueOnce('new-token');
    mockedService.registerFcmToken.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveOld = resolve;
    }));

    const oldRegistration = registerForPushAsync();
    await new Promise(process.nextTick);
    const newRegistration = registerForPushAsync();
    await new Promise(process.nextTick);
    expect(mockedService.registerFcmToken).toHaveBeenCalledTimes(1);
    resolveOld?.();
    expect(await oldRegistration).toBeNull();
    expect(await newRegistration).toBe('new-token');

    await unregisterPushAsync();
    expect(mockedService.unregisterFcmToken).toHaveBeenCalledWith('new-token');
    expect(mockedService.unregisterFcmToken).not.toHaveBeenCalledWith('old-token');
  });

  it('removes the prior token after a successful token rotation', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockedFirebase.getFcmToken
      .mockResolvedValueOnce('previous-token')
      .mockResolvedValueOnce('refreshed-token');

    expect(await registerForPushAsync()).toBe('previous-token');
    expect(await registerForPushAsync()).toBe('refreshed-token');
    expect(mockedService.unregisterFcmToken).toHaveBeenCalledWith('previous-token');
  });

  it('removes a cold-start token even when OS notification permission is denied', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
    mockedFirebase.getFcmToken.mockResolvedValue('cold-start-token');

    await unregisterPushAsync();

    expect(mockedNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockedNotifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mockedService.unregisterFcmToken).toHaveBeenCalledWith('cold-start-token');
  });

  it('skips cold-start removal if a new session starts during lookup', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockedFirebase.getFcmToken.mockImplementation(async () => {
      mockEpoch++;
      return 'previous-session-token';
    });

    await unregisterPushAsync();

    expect(mockedService.unregisterFcmToken).not.toHaveBeenCalled();
  });

  it('skips cold-start removal when native Firebase is unavailable', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockedFirebase.getFcmToken.mockResolvedValue(null);

    await unregisterPushAsync();

    expect(mockedService.unregisterFcmToken).not.toHaveBeenCalled();
  });

  it('exposes an unsubscribe function for token refresh', () => {
    const stop = jest.fn();
    const onRefresh = jest.fn();
    mockedFirebase.subscribeToFcmTokenRefresh.mockReturnValue(stop);

    expect(subscribeToPushTokenRefresh(onRefresh)).toBe(stop);
    expect(mockedFirebase.subscribeToFcmTokenRefresh).toHaveBeenCalledWith(onRefresh);
  });
});
