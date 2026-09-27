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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Glass } from '@/theme';
import { sawaaTokens } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { AquaBackground, PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { authService } from '@/services/auth';
import { authContinuationParams } from '@/features/booking/guest-booking-flow';

export default function ForgotPasswordScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const { booking, redirect } = useLocalSearchParams<{ booking?: string; redirect?: string }>();
  const insets = useSafeAreaInsets();
  const dir = useDir();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const validate = useCallback((): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setError(t('auth.register.emailError') || 'البريد الإلكتروني غير صالح');
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
          <Glass
            variant="strong"
            radius={22}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            interactive
            accessibilityLabel={t('a11y.buttonBack')}
            style={[styles.backBtn, { alignSelf: dir.alignStart }]}
          >
            {dir.isRTL ? (
              <ChevronRight size={22} color={colors.teal[700]} strokeWidth={1.75} />
            ) : (
              <ChevronLeft size={22} color={colors.teal[700]} strokeWidth={1.75} />
            )}
          </Glass>

          <Text
            style={[
              styles.title,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            استعادة كلمة المرور
          </Text>
          <Text
            style={[
              styles.subtitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            أدخل بريدك الإلكتروني لاستلام رمز التحقق
          </Text>

          <Glass variant="regular" radius={sawaaTokens.radius.lg} style={[styles.form, { marginTop: 24 }]}>
            <View style={styles.formInner}>
              <LabeledInput
                label="البريد الإلكتروني"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (error) setError(undefined);
                }}
                placeholder="example@email.com"
                error={error}
                keyboardType="email-address"
                autoCapitalize="none"
                dir={dir}
              />

              <PrimaryButton
                label={loading ? 'جارِ الإرسال...' : 'إرسال رمز التحقق'}
                onPress={handleSubmit}
                disabled={loading}
                style={{ marginTop: 8 }}
              />

              <View style={[styles.loginRow, { flexDirection: dir.row }]}>
                <Text style={styles.loginText}>تذكرت كلمة المرور؟ </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.back();
                  }}
                >
                  <Text style={styles.loginLink}>تسجيل الدخول</Text>
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
