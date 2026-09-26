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
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/sawaa/tokens';
import { AquaBackground } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useAppDispatch } from '@/hooks/use-redux';
import { setCredentials } from '@/stores/slices/auth-slice';
import { useVerifyOtp, useRequestLoginOtp } from '@/hooks/queries';
import { authService, SessionSupersededError } from '@/services/auth';
import { isSessionCurrent } from '@/services/native-session-state';
import { decodeBookingReturn } from '@/features/booking/guest-booking-flow';

const OTP_LENGTH = 4;
const RESEND_COOLDOWN = 60;

export default function OtpVerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    identifier: string;
    purpose: 'register' | 'login';
    maskedIdentifier: string;
    booking?: string;
  }>();
  const { identifier = '', purpose = 'register', maskedIdentifier = '' } = params;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { theme, isRTL } = useTheme();
  const colors = useSawaaColors();

  const [otp, setOtp] = useState('');
  const [loading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [resendLoading, setResendLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const submissionStarted = useRef(false);

  const verifyOtp = useVerifyOtp();
  const requestLoginOtp = useRequestLoginOtp();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleChange = useCallback((text: string) => {
    // A single native input receives the complete iOS/Android SMS suggestion or paste.
    // Four maxLength=1 inputs truncate autofill to one digit on some keyboards.
    setOtp(text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH));
  }, []);

  const handleVerify = useCallback(async () => {
    const code = otp;
    if (code.length !== OTP_LENGTH || submissionStarted.current) return;

    submissionStarted.current = true;
    setIsLoading(true);

    let verificationEpoch: number | null = null;
    try {
      const result = await verifyOtp.mutateAsync({ identifier, code, purpose });
      verificationEpoch = result.sessionEpoch;
      if (!isSessionCurrent(verificationEpoch)) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Fetch the profile directly after verifyMobileOtp persisted the new
      // namespace tokens. A useMe query can be enabled before persistence
      // finishes and refetch may join an in-flight request made with the
      // previous session's tokens.
      const profileResult = await authService.getProfile(result.sessionKind);
      if (!isSessionCurrent(verificationEpoch)) return;
      const profile = profileResult.success && profileResult.data;
      if (!profile) throw new Error('Authenticated profile unavailable');
      dispatch(setCredentials({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: profile,
      }));

      const bookingReturn = result.sessionKind === 'client' ? decodeBookingReturn(params.booking) : null;
      if (bookingReturn) {
        router.replace({ pathname: '/(client)/booking/payment', params: { ...bookingReturn } });
        return;
      }
      const destination = result.sessionKind === 'staff'
        ? '/(employee)/(tabs)/today'
        : '/(client)/(tabs)/home';
      router.replace(destination);
    } catch (error) {
      if (error instanceof SessionSupersededError ||
        (verificationEpoch !== null && !isSessionCurrent(verificationEpoch))) {
        return;
      }
      submissionStarted.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.otpError'));
      setOtp('');
      inputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  }, [otp, identifier, purpose, verifyOtp, dispatch, router, t, params.booking]);

  const handleResend = useCallback(async () => {
    if (purpose !== 'login') return;
    setResendLoading(true);
    try {
      await requestLoginOtp.mutateAsync({ identifier });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCountdown(RESEND_COOLDOWN);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.error.generic'));
    } finally {
      setResendLoading(false);
    }
  }, [purpose, identifier, requestLoginOtp, t]);

  // Auto-submit when all digits are filled
  useEffect(() => {
    if (otp.length === OTP_LENGTH && !loading) {
      handleVerify();
    }
  }, [otp, handleVerify, loading]);

  const isComplete = otp.length === OTP_LENGTH;
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <AquaBackground>
      <View style={styles.container}>
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
            accessibilityRole="button"
            accessibilityLabel={t('a11y.buttonBack')}
          >
            <BackIcon
              size={24}
              strokeWidth={1.5}
              color={theme.colors.textPrimary}
            />
          </Pressable>

          <View style={styles.header}>
            <Image
              source={require('../../assets/sawa/logo.png')}
              style={[styles.logo, { tintColor: colors.teal[700] }]}
              resizeMode="contain"
              accessible={false}
            />

            <ThemedText variant="displaySm" align="center">
              {t('auth.otp.title')}
            </ThemedText>
            <ThemedText
              variant="bodySm"
              align="center"
              color={theme.colors.textSecondary}
              style={styles.sub}
            >
              {t('auth.otp.sentTo')} {maskedIdentifier}
            </ThemedText>
          </View>

          <View style={styles.otpRow}>
            {Array.from({ length: OTP_LENGTH }, (_, index) => (
              <View
                key={`otp-${index}`}
                pointerEvents="none"
                style={[
                  styles.otpBox,
                  {
                    backgroundColor: theme.colors.surfaceHigh,
                    borderColor: otp[index] ? withAlpha(theme.colors.primary, 0.4) : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.digit, { color: theme.colors.textPrimary }]}>
                  {otp[index] ?? ''}
                </Text>
              </View>
            ))}
            <TextInput
              ref={inputRef}
              value={otp}
              onChangeText={handleChange}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              accessibilityLabel={t('auth.otp.code')}
              caretHidden
              selectionColor={theme.colors.surfaceHigh}
              style={styles.codeInput}
            />
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
              {loading ? t('auth.otp.submitting') : t('auth.otp.submit')}
            </ThemedButton>

            <View style={styles.resendRow}>
              {purpose === 'login' ? (
                countdown > 0 ? (
                  <ThemedText
                    variant="bodySm"
                    color={theme.colors.textMuted}
                    align="center"
                  >
                    {t('auth.otp.resendIn', { seconds: countdown })}
                  </ThemedText>
                ) : (
                  <Pressable onPress={handleResend} disabled={resendLoading}>
                    <ThemedText
                      variant="bodySm"
                      color={theme.colors.primary}
                      align="center"
                      style={styles.link}
                    >
                      {resendLoading ? t('common.loading') : t('auth.otp.resend')}
                    </ThemedText>
                  </Pressable>
                )
              ) : (
                <ThemedText
                  variant="bodySm"
                  color={theme.colors.textMuted}
                  align="center"
                >
                  {t('auth.otp.registerNoResend')}
                </ThemedText>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
      </View>
    </AquaBackground>
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
  logo: { width: 112, height: 112, marginBottom: 16 },
  sub: { marginTop: 8 },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
    position: 'relative',
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 22, fontWeight: '700' },
  codeInput: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    color: 'transparent',
    backgroundColor: 'transparent',
    textAlign: 'center',
  },
  actions: { gap: 20 },
  resendRow: { alignItems: 'center' },
  link: { fontWeight: '600' },
});
