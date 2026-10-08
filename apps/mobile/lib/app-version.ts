import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Application from 'expo-application';

type NativeVersion = { nativeApplicationVersion?: string | null; nativeBuildVersion?: string | null };
type VersionSource = Pick<typeof Constants, 'expoConfig' | 'platform'> & NativeVersion;

/** Native build metadata wins; configuration fallback belongs to the active platform. */
export function getAppVersion(
  constants: VersionSource = Constants,
  platform: typeof Platform.OS = Platform.OS,
  native: NativeVersion = Application,
): { version: string; buildNumber: string } {
  const configuredBuild = platform === 'ios' ? constants.expoConfig?.ios?.buildNumber
    : platform === 'android' ? constants.expoConfig?.android?.versionCode?.toString() : undefined;
  const platformBuild = platform === 'ios' ? constants.platform?.ios?.buildNumber
    : platform === 'android' ? constants.platform?.android?.versionCode?.toString() : undefined;
  return {
    version: native.nativeApplicationVersion ?? constants.nativeApplicationVersion ?? constants.expoConfig?.version ?? '—',
    buildNumber: native.nativeBuildVersion ?? constants.nativeBuildVersion ?? platformBuild ?? configuredBuild ?? '—',
  };
}
