import { Redirect } from 'expo-router';

/** Retired entry point: the account tab now owns everything this page showed. */
export default function LegacyProfileRoute() {
  return <Redirect href="/(client)/(tabs)/account" />;
}
