import { useState, useCallback } from 'react';
import { View, Pressable, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { authLoginHref } from '@/features/booking/guest-booking-flow';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dir = useDir();
  const { email, booking, redirect } = useLocalSearchParams<{ email: string; booking?: string; redirect?: string }>();

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'verify' | 'reset'>('verify');
  const [sessionToken, setSessionToken] = useState('');

  const clearError = (field: string) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validateVerify = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!code || code.length < 4) newErrors.code = t('auth.resetPassword.invalidCode');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [code, t]);

  const validateReset = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!newPassword || newPassword.length < 8) {
      newErrors.newPassword = t('auth.resetPassword.weakPassword');
    }
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = t('auth.resetPassword.mismatch');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [newPassword, confirmPassword, t]);

  const handleVerifyOtp = useCallback(async () => {
    if (!validateVerify()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      const result = await authService.verifyPasswordResetOtp(email, code);
      setSessionToken(result.sessionToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('reset');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.resetPassword.invalidCode'));
    } finally {
      setLoading(false);
    }
  }, [email, code, validateVerify, t]);

  const handleResetPassword = useCallback(async () => {
    if (!validateReset()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      await authService.resetClientPassword(sessionToken, newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('common.success'), t('auth.resetPassword.success'), [
        { text: t('auth.forgotPassword.back'), onPress: () => router.replace(authLoginHref(booking, redirect)) },
      ]);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.resetPassword.failed'));
    } finally {
      setLoading(false);
    }
  }, [sessionToken, newPassword, validateReset, router, t, booking, redirect]);

  return <AuthFormScaffold title={t(step === 'verify' ? 'auth.resetPassword.verifyTitle' : 'auth.resetPassword.newTitle')} onBack={() => router.back()}>
    <ThemedText variant="body">{t(step === 'verify' ? 'auth.resetPassword.otpStepSubtitle' : 'auth.resetPassword.passwordStepSubtitle', { email })}</ThemedText>
    <Glass variant="regular" radius={sawaaTokens.radius.lg} style={[styles.form, { marginTop: 24 }]}>
      <View style={styles.formInner}>
        {step === 'verify' ? (
          <>
            <LabeledInput
              label={t('auth.resetPassword.codeLabel')}
              value={code}
              onChangeText={(v) => {
                setCode(v);
                clearError('code');
              }}
              placeholder="123456"
              error={errors.code}
              keyboardType="number-pad" textContentType="oneTimeCode" inputStyle={{ textAlign: 'center', writingDirection: 'ltr' }}
              dir={dir}
            />
            <AppButton
              label={t('auth.resetPassword.verifyCode')} loading={loading}
              onPress={handleVerifyOtp}
              disabled={loading}
              style={{ marginTop: 8 }}
            />
          </>
        ) : (
          <>
            <LabeledInput
              label={t('auth.resetPassword.newPasswordLabel')}
              value={newPassword}
              onChangeText={(v) => {
                setNewPassword(v);
                clearError('newPassword');
              }}
              placeholder="********"
              error={errors.newPassword}
              secureTextEntry
              dir={dir}
            />
            <LabeledInput
              label={t('auth.resetPassword.confirmPasswordLabel')}
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v);
                clearError('confirmPassword');
              }}
              placeholder="********"
              error={errors.confirmPassword}
              secureTextEntry
              dir={dir}
            />
            <AppButton
              label={t('auth.resetPassword.submit')} loading={loading}
              onPress={handleResetPassword}
              disabled={loading}
              style={{ marginTop: 8 }}
            />
          </>
        )}

        <View style={[styles.loginRow, { flexDirection: dir.row }]}>
          <ThemedText variant="body">{t('auth.forgotPassword.remembered')}</ThemedText>
          <Pressable accessibilityRole="link" style={styles.loginLink}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.replace(authLoginHref(booking, redirect));
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
