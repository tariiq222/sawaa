import { Redirect, Stack, useGlobalSearchParams, useSegments } from 'expo-router';

import { useAppSelector } from '@/hooks/use-redux';
import { getPrimaryRole } from '@/types/auth';
import { loginRedirectHref } from '@/lib/navigation';

export default function EmployeeLayout() {
  const { token, user } = useAppSelector((state) => state.auth);
  // The protected route the visitor asked for, so login can hand it back after
  // the OTP step instead of dropping them on the tab bar.
  const segments = useSegments();
  const params = useGlobalSearchParams();

  if (!token) {
    return <Redirect href={loginRedirectHref(segments, params)} />;
  }

  if (!user || getPrimaryRole(user) === 'client') {
    return <Redirect href="/(client)/(tabs)/home" />;
  }

  return <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />;
}
