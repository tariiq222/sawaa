import { Redirect, useLocalSearchParams } from 'expo-router';
import { authContinuationParams } from '@/features/booking/guest-booking-flow';

/** Registration now starts on the phone-first entry screen. */
export default function RegisterScreen() {
  const { booking, redirect } = useLocalSearchParams<{ booking?: string; redirect?: string }>();
  const params = authContinuationParams(booking, redirect);
  return <Redirect href={params.booking || params.redirect
    ? { pathname: '/(auth)/login', params }
    : '/(auth)/login'} />;
}
