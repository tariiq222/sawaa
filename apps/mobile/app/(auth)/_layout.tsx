import { Stack } from 'expo-router';

import { useStackDirectionOptions } from '@/hooks/useStackDirectionOptions';

export default function AuthLayout() {
  const stackDirection = useStackDirectionOptions();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        ...stackDirection,
      }}
    />
  );
}
