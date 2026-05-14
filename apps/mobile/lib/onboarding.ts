/**
 * Onboarding flag — persists whether the user has seen the onboarding flow.
 * Stored in AsyncStorage (preferences, not sensitive).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_SEEN_KEY = 'sawaa.onboarding.seen.v1';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
    return value === '1';
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1');
  } catch {
    // Non-fatal: user just sees onboarding again next launch.
  }
}

export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_SEEN_KEY);
  } catch {
    // Non-fatal.
  }
}
