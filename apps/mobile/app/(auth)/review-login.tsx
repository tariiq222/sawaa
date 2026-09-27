import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AquaBackground, PrimaryButton } from '@/theme/sawaa';
import { ThemedText } from '@/theme/components/ThemedText';
import { BackButton } from '@/components/ui/BackButton';
import { sawaaTokens } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getFontName } from '@/theme/fonts';
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
  const colors = useSawaaColors();
  const styles = createStyles(colors);
  const dir = useDir();
  const insets = useSafeAreaInsets();
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
        router.replace({ pathname: '/(client)/booking/payment', params: { ...bookingReturn } });
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

  return (
    <AquaBackground>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <BackButton onPress={() => router.back()} style={{ alignSelf: dir.alignStart }} />
          <ThemedText variant="heading">{t('auth.review.title')}</ThemedText>
          <ThemedText>{t('auth.review.subtitle')}</ThemedText>
          <View style={styles.field}>
            <ThemedText>{t('auth.email')}</ThemedText>
            <TextInput accessibilityLabel={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="username" style={styles.input} editable={!loading} />
          </View>
          <View style={styles.field}>
            <ThemedText>{t('auth.password')}</ThemedText>
            <TextInput accessibilityLabel={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="password" textContentType="password" style={styles.input} editable={!loading} onSubmitEditing={submit} />
          </View>
          <PrimaryButton label={loading ? t('common.loading') : t('auth.review.submit')} onPress={submit} disabled={loading || !email.trim() || !password} />
        </ScrollView>
      </KeyboardAvoidingView>
    </AquaBackground>
  );
}
const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  flex: { flex: 1, direction: 'ltr' },
  content: { paddingHorizontal: 24, gap: 24 },
  field: { gap: 8 },
  input: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: colors.teal[200], borderRadius: sawaaTokens.radius.md, backgroundColor: colors.glass.opaqueBg, color: colors.ink[900], fontFamily: getFontName('ar', '400'), fontSize: 16, textAlign: 'left', writingDirection: 'ltr' },
});
