import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Glass } from '@/theme';
import { sawaaTokens, sawaaColors } from '@/theme/sawaa/tokens';
import { PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { authService } from '@/services/auth';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { email } = useLocalSearchParams<{ email: string }>();

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
    if (!code || code.length < 4) newErrors.code = 'الرمز غير صالح';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [code]);

  const validateReset = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!newPassword || newPassword.length < 8) {
      newErrors.newPassword = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    }
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'كلمتا المرور غير متطابقتين';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [newPassword, confirmPassword]);

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
      Alert.alert(t('common.error'), 'رمز التحقق غير صحيح أو منتهي الصلاحية');
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
      Alert.alert('تم', 'تم تغيير كلمة المرور بنجاح', [
        { text: 'تسجيل الدخول', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), 'تعذر تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }
  }, [sessionToken, newPassword, validateReset, router, t]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

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
          <Glass
            variant="strong"
            radius={22}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            interactive
            style={styles.backBtn}
          >
            {dir.isRTL ? (
              <ChevronRight size={22} color={sawaaColors.teal[700]} strokeWidth={1.75} />
            ) : (
              <ChevronLeft size={22} color={sawaaColors.teal[700]} strokeWidth={1.75} />
            )}
          </Glass>

          <Text
            style={[
              styles.title,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {step === 'verify' ? 'التحقق من الرمز' : 'كلمة مرور جديدة'}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {step === 'verify'
              ? `أدخل رمز التحقق المرسل إلى ${email}`
              : 'أدخل كلمة المرور الجديدة'}
          </Text>

          <Glass variant="regular" radius={sawaaTokens.radius.lg} style={[styles.form, { marginTop: 24 }]}>
            <View style={styles.formInner}>
              {step === 'verify' ? (
                <>
                  <LabeledInput
                    label="رمز التحقق"
                    value={code}
                    onChangeText={(v) => {
                      setCode(v);
                      clearError('code');
                    }}
                    placeholder="123456"
                    error={errors.code}
                    keyboardType="number-pad"
                    dir={dir}
                  />
                  <PrimaryButton
                    label={loading ? 'جارِ التحقق...' : 'تحقق'}
                    onPress={handleVerifyOtp}
                    disabled={loading}
                    style={{ marginTop: 8 }}
                  />
                </>
              ) : (
                <>
                  <LabeledInput
                    label="كلمة المرور الجديدة"
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
                    label="تأكيد كلمة المرور"
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
                    label={loading ? 'جارِ الحفظ...' : 'حفظ كلمة المرور'}
                    onPress={handleResetPassword}
                    disabled={loading}
                    style={{ marginTop: 8 }}
                  />
                </>
              )}

              <View style={[styles.loginRow, { flexDirection: dir.row }]}>
                <Text style={styles.loginText}>تذكرت كلمة المرور؟ </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.replace('/(auth)/login');
                  }}
                >
                  <Text style={styles.loginLink}>تسجيل الدخول</Text>
                </Pressable>
              </View>
            </View>
          </Glass>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  title: { fontSize: 32, fontWeight: '800', color: sawaaColors.teal[700], lineHeight: 42, marginBottom: 8 },
  subtitle: { fontSize: 14, color: sawaaColors.ink[500], lineHeight: 20 },
  form: { padding: 24 },
  formInner: { gap: 16 },
  loginRow: { alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  loginText: { fontSize: 14, color: sawaaColors.ink[500] },
  loginLink: { fontSize: 14, fontWeight: '700', color: sawaaColors.teal[700] },
});
