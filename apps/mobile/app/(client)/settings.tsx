import { Redirect } from 'expo-router';

/** Retired entry point: preferences now live inline on the account tab. */
export default function LegacySettingsRoute() {
  return <Redirect href="/(client)/(tabs)/account" />;
}
