import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Glass } from '@/theme';
import { BackButton } from '@/components/ui/BackButton';
import { sawaaTokens } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { AquaBackground, PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { authService } from '@/services/auth';
import { authLoginHref } from '@/features/booking/guest-booking-flow';

export default function ResetPasswordScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { identifier: target, email, booking, redirect } = useLocalSearchParams<{ identifier?: string; email?: string; booking?: string; redirect?: string }>();
  const identifier = target ?? email ?? '';

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
    if (!/^\d{4}$/.test(code)) newErrors.code = t('auth.resetPassword.invalidCode');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [code, t]);

  const validateReset = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (newPassword.length < 8 || newPassword.length > 200 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      newErrors.newPassword = t('auth.resetPassword.weakPassword');
    }
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordMismatch');
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
      const result = await authService.verifyPasswordResetOtp(identifier, code);
      setSessionToken(result.sessionToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('reset');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.resetPassword.invalidCode'));
    } finally {
      setLoading(false);
    }
  }, [identifier, code, validateVerify, t]);

  const handleResetPassword = useCallback(async () => {
    if (!validateReset()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      await authService.resetClientPassword(sessionToken, newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSessionToken(''); setNewPassword(''); setConfirmPassword('');
      Alert.alert(t('common.success'), t('auth.resetPassword.success'), [
        { text: t('auth.loginNow'), onPress: () => router.replace(authLoginHref(booking, redirect)) },
      ]);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.error.generic'));
    } finally {
      setLoading(false);
    }
  }, [sessionToken, newPassword, validateReset, router, t, booking, redirect]);

  return (
    <AquaBackground>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <BackButton onPress={() => router.back()} style={[styles.backBtn, { alignSelf: dir.alignStart }]} />

          <Text
            style={[
              styles.title,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {t(step === 'verify' ? 'auth.resetPassword.verifyCode' : 'auth.resetPassword.newPasswordLabel')}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {step === 'verify'
              ? t('auth.resetPassword.otpStepSubtitle', { identifier })
              : t('auth.resetPassword.passwordStepSubtitle')}
          </Text>

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
                    placeholder="1234"
                    maxLength={4}
                    error={errors.code}
                    keyboardType="number-pad"
                    dir={dir}
                  />
                  <PrimaryButton
                    label={loading ? t('common.loading') : t('auth.resetPassword.verifyCode')}
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
                    label={t('auth.confirmPassword')}
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
                  <PrimaryButton
                    label={loading ? t('common.loading') : t('auth.resetPassword.submit')}
                    onPress={handleResetPassword}
                    disabled={loading}
                    style={{ marginTop: 8 }}
                  />
                </>
              )}

              <View style={[styles.loginRow, { flexDirection: dir.row }]}>
                <Text style={styles.loginText}>{t('auth.hasAccount')} </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.replace(authLoginHref(booking, redirect));
                  }}
                >
                  <Text style={styles.loginLink}>{t('auth.loginNow')}</Text>
                </Pressable>
              </View>
            </View>
          </Glass>
        </ScrollView>
      </KeyboardAvoidingView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  title: { fontSize: 32, fontWeight: '800', color: colors.teal[700], lineHeight: 42, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.ink[500], lineHeight: 20 },
  form: { padding: 24 },
  formInner: { gap: 16 },
  loginRow: { alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  loginText: { fontSize: 14, color: colors.ink[500] },
  loginLink: { fontSize: 14, fontWeight: '700', color: colors.teal[700] },
});
