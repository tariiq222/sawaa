import { Redirect } from 'expo-router';

export default function LegacyChatRoute() {
  return <Redirect href="/(client)/(tabs)/chat" />;
}
