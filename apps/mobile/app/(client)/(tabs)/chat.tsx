import { Redirect } from 'expo-router';

/**
 * Retired messaging entry point. Keep the deep-link path resolvable while the
 * client-facing tab is no longer exposed in the native tab bar.
 */
export default function RetiredChatRoute() {
  return <Redirect href="/(client)/(tabs)/home" />;
}
