import { Redirect, Slot } from 'expo-router';

import { useAppSelector } from '@/hooks/use-redux';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { getPrimaryRole } from '@/types/auth';

export default function ClientLayout() {
  const { token, user } = useAppSelector((state) => state.auth);

  usePushNotifications(!!token);

  // DEV preview: auth guard temporarily disabled to review client UI without
  // a working backend login. Re-enable when auth flow is wired up.
  // if (!token) {
  //   return <Redirect href="/(auth)/login" />;
  // }

  if (token && user && getPrimaryRole(user) === 'employee') {
    return <Redirect href="/(employee)/(tabs)/today" />;
  }

  return <Slot />;
}
