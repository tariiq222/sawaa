import { Redirect } from 'expo-router';

/** Retired entry point: completed sessions live under the appointments tab. */
export default function LegacyRecordsRoute() {
  return <Redirect href="/(client)/(tabs)/appointments" />;
}
