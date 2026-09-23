import { Redirect, Stack } from 'expo-router';

import { useAppSelector } from '@/hooks/use-redux';
import { getPrimaryRole } from '@/types/auth';

export default function EmployeeLayout() {
  const { token, user } = useAppSelector((state) => state.auth);


  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!user || getPrimaryRole(user) === 'client') {
    return <Redirect href="/(client)/(tabs)/home" />;
  }

  return <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />;
}
