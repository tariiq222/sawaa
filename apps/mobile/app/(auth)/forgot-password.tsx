import { useState, useCallback } from 'react';
import { View, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { Glass } from '@/theme/components/Glass';
import { AuthFormScaffold } from '@/components/features/auth/AuthFormScaffold';
import { ThemedText } from '@/theme/components/ThemedText';
import { AppButton } from '@/components/ui/AppButton';
import { sawaaSpacing } from '@/theme/sawaa/tokens';
import { sawaaTokens } from '@/theme/sawaa/tokens';
import { useDir } from '@/hooks/useDir';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { authService } from '@/services/auth';
import { authContinuationParams } from '@/features/booking/guest-booking-flow';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { booking, redirect } = useLocalSearchParams<{ booking?: string; redirect?: string }>();
  const dir = useDir();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const validate = useCallback((): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setError(t('auth.register.emailError'));
      return false;
    }
    return true;
  }, [email, t]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      await authService.requestPasswordResetOtp(email.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: '/(auth)/reset-password',
        params: { email: email.trim(), ...authContinuationParams(booking, redirect) },
      });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.error.generic'));
    } finally {
      setLoading(false);
    }
  }, [email, validate, router, t, booking, redirect]);

  return <AuthFormScaffold title={t('auth.forgotPassword.title')} onBack={() => router.back()}>
    <ThemedText variant="body">{t('auth.forgotPassword.subtitle')}</ThemedText>
    <Glass variant="regular" radius={sawaaTokens.radius.lg} style={[styles.form, { marginTop: 24 }]}>
      <View style={styles.formInner}>
        <LabeledInput
          label={t('auth.forgotPassword.emailLabel')}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (error) setError(undefined);
          }}
          placeholder="example@email.com"
          error={error}
          keyboardType="email-address" inputStyle={{ textAlign: 'left', writingDirection: 'ltr' }}
          autoCapitalize="none"
          dir={dir}
        />

        <AppButton
          label={t('auth.forgotPassword.submit')} loading={loading}
          onPress={handleSubmit}
          disabled={loading}
          style={{ marginTop: 8 }}
        />

        <View style={[styles.loginRow, { flexDirection: dir.row }]}>
          <ThemedText variant="body">{t('auth.forgotPassword.remembered')}</ThemedText>
          <Pressable accessibilityRole="link" style={styles.loginLink}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <ThemedText variant="body">{t('auth.forgotPassword.back')}</ThemedText>
          </Pressable>
        </View>
      </View>
    </Glass>
  </AuthFormScaffold>;
}

const styles = StyleSheet.create({
  form: { padding: sawaaSpacing.lg }, formInner: { gap: sawaaSpacing.lg },
  loginRow: { alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: sawaaSpacing.xs, marginTop: sawaaSpacing.sm },
  loginLink: { minHeight: 44, justifyContent: 'center' },
});
