import { AuthFormScaffold } from '@/components/features/auth/AuthFormScaffold';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { AppButton } from '@/components/ui/AppButton';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/theme/components/ThemedText';
import { useDir } from '@/hooks/useDir';
import { useAppDispatch } from '@/hooks/use-redux';
import { setCredentials } from '@/stores/slices/auth-slice';
import { authService, loginReviewAccount, SessionSupersededError } from '@/services/auth';
import { clearSessionAtEpoch, isSessionCurrent } from '@/services/native-session-state';
import { decodeBookingReturn } from '@/features/booking/guest-booking-flow';
import { decodeRedirect } from '@/lib/navigation';

export default function ReviewLoginScreen() {
  const { booking, redirect } = useLocalSearchParams<{ booking?: string; redirect?: string }>();
  const { t } = useTranslation();
  const dir = useDir();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const pending = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (pending.current || !email.trim() || !password) return;
    pending.current = true;
    setLoading(true);
    let epoch: number | undefined;
    try {
      const result = await loginReviewAccount({ email: email.trim().toLowerCase(), password });
      epoch = result.sessionEpoch;
      if (!isSessionCurrent(epoch)) return;
      const profile = await authService.getProfile('client');
      if (!isSessionCurrent(epoch)) return;
      if (!profile.success || !profile.data || profile.data.role !== 'CLIENT') throw new Error('Client profile unavailable');
      dispatch(setCredentials({ ...result.tokens, user: profile.data }));
      setPassword('');
      const bookingReturn = decodeBookingReturn(booking);
      if (bookingReturn) {
        const { amount, ...selection } = bookingReturn;
        router.replace({ pathname: '/(client)/booking/confirm', params: { ...selection, chargedPrice: amount } });
        return;
      }
      const redirectReturn = decodeRedirect(redirect);
      if (redirectReturn) {
        router.replace(redirectReturn);
        return;
      }
      router.replace('/(client)/(tabs)/home');
    } catch (error) {
      if (error instanceof SessionSupersededError || (epoch !== undefined && !isSessionCurrent(epoch))) return;
      if (epoch !== undefined) await clearSessionAtEpoch(epoch);
      Alert.alert(t('common.error'), t('auth.review.error'));
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return <AuthFormScaffold title={t('auth.review.title')} onBack={() => router.back()}>
    <ThemedText>{t('auth.review.subtitle')}</ThemedText>
    <LabeledInput label={t('auth.email')} value={email} onChangeText={setEmail} dir={dir}
      keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email"
      textContentType="username" editable={!loading} inputStyle={{ textAlign: 'left', writingDirection: 'ltr' }} />
    <LabeledInput label={t('auth.password')} value={password} onChangeText={setPassword} dir={dir}
      secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="password"
      textContentType="password" editable={!loading} onSubmitEditing={submit} />
    <AppButton label={t('auth.review.submit')} loading={loading} disabled={loading || !email.trim() || !password} onPress={submit} />
  </AuthFormScaffold>;
}
