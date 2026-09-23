import Constants from 'expo-constants';
import { Platform } from 'react-native';

type NativeMessaging = typeof import('@react-native-firebase/messaging');

/** Native Firebase is unavailable in Expo Go and web builds. Load it only on demand. */
function loadMessaging(): NativeMessaging | null {
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return null;
  try {
    return require('@react-native-firebase/messaging') as NativeMessaging;
  } catch (error) {
    console.warn('[Push] Firebase Messaging native module unavailable:', error);
    return null;
  }
}

/** Returns only a Firebase registration token, never a raw APNs or Expo token. */
export async function getFcmToken(): Promise<string | null> {
  const native = loadMessaging();
  if (!native) return null;

  try {
    const messaging = native.getMessaging();
    if (Platform.OS === 'ios') {
      await native.registerDeviceForRemoteMessages(messaging);
    }
    const token = await native.getToken(messaging);
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch (error) {
    console.warn('[Push] Failed to obtain FCM token:', error);
    return null;
  }
}

/** Subscribe after authentication; the caller owns backend registration and cleanup. */
export function subscribeToFcmTokenRefresh(listener: (token: string) => void): () => void {
  const native = loadMessaging();
  if (!native) return () => undefined;
  try {
    return native.onTokenRefresh(native.getMessaging(), listener);
  } catch (error) {
    console.warn('[Push] Failed to subscribe to FCM token refresh:', error);
    return () => undefined;
  }
}
