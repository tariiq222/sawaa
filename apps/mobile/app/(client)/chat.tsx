import { Redirect } from 'expo-router';

/** Retired chat entry point: old deep links land on the client home tab. */
export default function LegacyChatRoute() {
  return <Redirect href="/(client)/(tabs)/home" />;
}
