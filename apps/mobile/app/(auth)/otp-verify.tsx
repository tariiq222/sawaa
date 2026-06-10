import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  StyleSheet,
  Text,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { useTheme } from '@/theme/useTheme';
import { useAppDispatch } from '@/hooks/use-redux';
import { setAuthSession, setUser } from '@/stores/slices/auth-slice';
import { useVerifyOtp, useRequestLoginOtp, useMe } from '@/hooks/queries';
import { registerForPushAsync } from '@/services/push';

const OTP_LENGTH = 4;
const RESEND_COOLDOWN = 60;

export default function OtpVerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    identifier: string;
    purpose: 'register' | 'login';
    maskedIdentifier: string;
  }>();
  const { identifier = '', purpose = 'register', maskedIdentifier = '' } = params;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { theme, isRTL } = useTheme();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [resendLoading, setResendLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const verifyOtp = useVerifyOtp();
  const requestLoginOtp = useRequestLoginOtp();
  const { refetch: refetchMe } = useMe();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleChange = useCallback(
    (text: string, index: number) => {
      if (text.length > 1) {
        const pasted = text.slice(0, OTP_LENGTH).split('');
        const newOtp = [...otp];
        pasted.forEach((char, i) => {
          if (index + i < OTP_LENGTH) {
            newOtp[index + i] = char;
          }
        });
        setOtp(newOtp);
        const nextIndex = Math.min(index + pasted.length, OTP_LENGTH - 1);
        inputRefs.current[nextIndex]?.focus();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);

      if (text && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [otp],
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
      }
    },
    [otp],
  );

  const handleVerify = useCallback(async () => {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) return;

    setIsLoading(true);

    try {
      const result = await verifyOtp.mutateAsync({ identifier, code, purpose });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      dispatch(setAuthSession({ tokens: result.tokens }));
      void registerForPushAsync();

      const meResult = await refetchMe();
      const profile = meResult.data?.data;
      if (profile) {
        dispatch(setUser(profile));
      }

      // Group layout guards redirect staff users to the employee tabs.
      router.replace('/(client)/(tabs)/home');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.otpError'));
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  }, [otp, identifier, purpose, verifyOtp, dispatch, refetchMe, router, t]);

  const handleResend = useCallback(async () => {
    if (purpose !== 'login') return;
    setResendLoading(true);
    try {
      await requestLoginOtp.mutateAsync({ identifier });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCountdown(RESEND_COOLDOWN);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('error.generic'));
    } finally {
      setResendLoading(false);
    }
  }, [purpose, identifier, requestLoginOtp, t]);

  // Auto-submit when all digits are filled
  useEffect(() => {
    if (otp.every((digit) => digit !== '') && !loading) {
      handleVerify();
    }
  }, [otp, handleVerify, loading]);

  const isComplete = otp.every((d) => d !== '');
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View
          style={[
            styles.content,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
          ]}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.backBtn}
          >
            <BackIcon
              size={24}
              strokeWidth={1.5}
              color={theme.colors.textPrimary}
            />
          </Pressable>

          <View style={styles.header}>
            <LinearGradient
              colors={['#0037B0', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconBadge}
            >
              <ThemedText
                variant="displaySm"
                color="#FFF"
                align="center"
                style={{ fontSize: 28 }}
              >
                {'#'}
              </ThemedText>
            </LinearGradient>

            <ThemedText variant="displaySm" align="center">
              {t('otp.title')}
            </ThemedText>
            <ThemedText
              variant="bodySm"
              align="center"
              color={theme.colors.textSecondary}
              style={styles.sub}
            >
              {t('otp.sentTo')} {maskedIdentifier}
            </ThemedText>
          </View>

          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={`otp-${index}`}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
                onKeyPress={({ nativeEvent: { key } }) =>
                  handleKeyPress(key, index)
                }
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                accessibilityLabel={t('auth.otpBoxLabel', {
                  index: index + 1,
                  total: OTP_LENGTH,
                })}
                style={[
                  styles.otpBox,
                  {
                    backgroundColor: theme.colors.surfaceHigh,
                    borderColor: digit ? '#1D4ED866' : 'transparent',
                    color: theme.colors.textPrimary,
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <ThemedButton
              onPress={handleVerify}
              variant="primary"
              size="lg"
              full
              loading={loading}
              disabled={!isComplete || loading}
            >
              {loading ? t('otp.submitting') : t('otp.submit')}
            </ThemedButton>

            <View style={styles.resendRow}>
              {purpose === 'login' ? (
                countdown > 0 ? (
                  <ThemedText
                    variant="bodySm"
                    color={theme.colors.textMuted}
                    align="center"
                  >
                    {t('otp.resendIn', { seconds: countdown })}
                  </ThemedText>
                ) : (
                  <Pressable onPress={handleResend} disabled={resendLoading}>
                    <ThemedText
                      variant="bodySm"
                      color="#1D4ED8"
                      align="center"
                      style={styles.link}
                    >
                      {resendLoading ? t('common.loading') : t('otp.resend')}
                    </ThemedText>
                  </Pressable>
                )
              ) : (
                <ThemedText
                  variant="bodySm"
                  color={theme.colors.textMuted}
                  align="center"
                >
                  {t('otp.registerNoResend') ?? 'Tap back and re-submit if you didn\'t receive the code.'}
                </ThemedText>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  header: { alignItems: 'center', marginBottom: 40 },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  sub: { marginTop: 8 },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  actions: { gap: 20 },
  resendRow: { alignItems: 'center' },
  link: { fontWeight: '600' },
});
