import { Redirect, Stack } from 'expo-router';

import { useAppSelector } from '@/hooks/use-redux';
import { getPrimaryRole } from '@/types/auth';

export default function ClientLayout() {
  const { token, user } = useAppSelector((state) => state.auth);


  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  if (token && user && getPrimaryRole(user) !== 'client') {
    return <Redirect href="/(employee)/(tabs)/today" />;
  }

  return <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />;
}
