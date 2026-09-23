import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import { notificationsService } from './notifications';
import { getFcmToken, subscribeToFcmTokenRefresh as subscribeToNativeTokenRefresh } from './firebase-messaging';
import { getSessionEpoch, isSessionCurrent } from './native-session-state';

let registeredToken: string | null = null;
let registrationGeneration = 0;
let tokenBeingRegistered: string | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation);
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

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

/**
 * Request permission, fetch a Firebase token, register it with the backend.
 * Returns the registered token on success, `null` on any failure (no throw).
 *
 * - Skipped on web (`Platform.OS === 'web'`).
 * - Skipped on simulators (`Device.isDevice === false`).
 * - Silently fails if permission denied — caller is the auth flow.
 */
export async function registerForPushAsync(isCurrent: () => boolean = () => true): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;
  const sessionEpoch = getSessionEpoch();
  const generation = ++registrationGeneration;
  const stillCurrent = () =>
    generation === registrationGeneration && isSessionCurrent(sessionEpoch) && isCurrent();

  try {
    if (!stillCurrent()) return null;
    configureForegroundHandler();
    await setupAndroidChannel();
    if (!stillCurrent()) return null;

    const granted = await requestPermission();
    if (!granted || !stillCurrent()) return null;

    const token = await getFcmToken();
    if (!token || !stillCurrent()) return null;

    const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
    return await enqueueMutation(async () => {
      if (!stillCurrent()) return null;
      tokenBeingRegistered = token;
      try {
        await notificationsService.registerFcmToken(token, platform);
        if (!stillCurrent()) return null;
        const previousToken = registeredToken;
        registeredToken = token;
        if (previousToken && previousToken !== token) {
          try {
            await notificationsService.unregisterFcmToken(previousToken);
          } catch {
            // The old token may have already expired or been removed.
          }
        }
        return token;
      } finally {
        tokenBeingRegistered = null;
      }
    });
  } catch (error) {
    console.warn('[Push] Failed to register for push:', error);
    return null;
  }
}

/** The authenticated hook owns this subscription and must dispose it on cleanup. */
export function subscribeToFcmTokenRefresh(listener: (token: string) => void): () => void {
  if (Platform.OS === 'web' || !Device.isDevice) return () => undefined;
  return subscribeToNativeTokenRefresh(listener);
}

/**
 * Unregister this device's token from the backend. On a cold start, look up the
 * native FCM token without prompting for notification permission.
 */
export async function unregisterPushAsync(): Promise<void> {
  const sessionEpoch = getSessionEpoch();
  registrationGeneration++;
  const tokens = [...new Set([registeredToken, tokenBeingRegistered].filter(
    (token): token is string => Boolean(token),
  ))];
  registeredToken = null;
  if (tokens.length === 0 && Platform.OS !== 'web' && Device.isDevice) {
    try {
      const token = await getFcmToken();
      if (token && isSessionCurrent(sessionEpoch)) tokens.push(token);
    } catch {
      // Native Firebase may be unavailable during logout.
    }
  }
  if (tokens.length === 0) return;
  await enqueueMutation(async () => {
    for (const token of tokens) {
      if (!isSessionCurrent(sessionEpoch)) return;
      try {
        await notificationsService.unregisterFcmToken(token);
      } catch {
        // Server may already have evicted the token; continue with the next.
      }
    }
  });
}

/** Test-only — reset module state between tests. */
export function __resetPushStateForTests(): void {
  registeredToken = null;
  registrationGeneration = 0;
  tokenBeingRegistered = null;
  mutationQueue = Promise.resolve();
  handlerConfigured = false;
}
