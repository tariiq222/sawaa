import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import { notificationsService } from './notifications';

let registeredToken: string | null = null;

/**
 * Lazily configure the foreground handler the first time we touch push.
 * Idempotent — safe to call repeatedly.
 */
let handlerConfigured = false;
function configureForegroundHandler(): void {
  if (handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  handlerConfigured = true;
}

async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

async function requestPermission(): Promise<boolean> {
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function getDeviceToken(): Promise<string | null> {
  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    return tokenData.data;
  } catch (error) {
    console.warn('[Push] Failed to get device push token:', error);
    return null;
  }
}

/**
 * Request permission, fetch the device token, register it with the backend.
 * Returns the registered token on success, `null` on any failure (no throw).
 *
 * - Skipped on web (`Platform.OS === 'web'`).
 * - Skipped on simulators (`Device.isDevice === false`).
 * - Silently fails if permission denied — caller is the auth flow.
 */
export async function registerForPushAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;

  configureForegroundHandler();

  const granted = await requestPermission();
  if (!granted) return null;

  await setupAndroidChannel();

  const token = await getDeviceToken();
  if (!token) return null;

  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

  try {
    await notificationsService.registerFcmToken(token, platform);
    registeredToken = token;
    return token;
  } catch (error) {
    console.warn('[Push] Failed to register FCM token:', error);
    return null;
  }
}

/**
 * Unregister the previously-registered token from the backend. Safe to call
 * even when no token was ever registered — it becomes a no-op.
 */
export async function unregisterPushAsync(): Promise<void> {
  if (!registeredToken) return;
  try {
    await notificationsService.unregisterFcmToken();
  } catch {
    // Ignore — server may already have evicted the token.
  } finally {
    registeredToken = null;
  }
}

/** Test-only — reset module state between tests. */
export function __resetPushStateForTests(): void {
  registeredToken = null;
  handlerConfigured = false;
}
