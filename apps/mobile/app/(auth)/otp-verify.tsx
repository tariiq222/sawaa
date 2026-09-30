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
import { Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { AquaBackground, PrimaryButton } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useAppDispatch } from '@/hooks/use-redux';
import { setCredentials } from '@/stores/slices/auth-slice';
import { useVerifyOtp, useRequestLoginOtp } from '@/hooks/queries';
import { authService, SessionSupersededError } from '@/services/auth';
import { isSessionCurrent } from '@/services/native-session-state';
import { decodeBookingReturn } from '@/features/booking/guest-booking-flow';
import { decodeRedirect } from '@/lib/navigation';

const OTP_LENGTH = 4;
const RESEND_COOLDOWN = 60;

function redirectMatchesSession(
  value: string | string[] | undefined,
  sessionKind: 'client' | 'staff',
): boolean {
  const candidate = Array.isArray(value) ? value[0] : value;
  const pathname = candidate?.split(/[?#]/, 1)[0] ?? '';
  const routeGroup = pathname.split('/')[1];
  return sessionKind === 'staff'
    ? routeGroup === '(employee)'
    : routeGroup !== '(employee)';
}

export default function OtpVerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    identifier: string;
    purpose: 'register' | 'login';
    maskedIdentifier: string;
    booking?: string;
    redirect?: string;
  }>();
  const { identifier = '', purpose = 'register', maskedIdentifier = '' } = params;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const colors = useSawaaColors();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');

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
      // Older clients may omit sessionKind; those sessions have always used
      // the client landing path, so keep that fallback explicit for routing.
      const sessionKind = result.sessionKind ?? 'client';
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

      const bookingReturn = sessionKind === 'client' ? decodeBookingReturn(params.booking) : null;
      if (bookingReturn) {
        const { amount, ...selection } = bookingReturn;
        router.replace({ pathname: '/(client)/booking/confirm', params: { ...selection, chargedPrice: amount } });
        return;
      }
      if (redirectMatchesSession(params.redirect, sessionKind)) {
        const redirect = decodeRedirect(params.redirect);
        if (redirect) {
          router.replace(redirect);
          return;
        }
      }
      const destination = sessionKind === 'staff'
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
  }, [otp, identifier, purpose, verifyOtp, dispatch, router, t, params.booking, params.redirect]);

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

  return (
    <AquaBackground>
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
          <ScreenHeader title={t('auth.otp.title')} onBack={() => router.back()} />

          <View style={styles.header}>
            <View style={[styles.lockCircle, { backgroundColor: colors.glass.opaqueBg }]}>
              <Lock size={32} color={colors.teal[700]} strokeWidth={1.75} />
            </View>
            <Text
              style={[
                styles.sub,
                { color: colors.ink[700], fontFamily: f400, writingDirection: dir.writingDirection },
              ]}
            >
              {t('auth.otp.sentTo')} {maskedIdentifier}
            </Text>
          </View>

          <View style={styles.otpRow}>
            {Array.from({ length: OTP_LENGTH }, (_, index) => (
              <View
                key={`otp-${index}`}
                pointerEvents="none"
                style={[
                  styles.otpBox,
                  {
                    backgroundColor: colors.glass.opaqueBg,
                    borderColor: otp[index] ? colors.teal[600] : colors.teal[200],
                  },
                ]}
              >
                <Text style={[styles.digit, { color: colors.ink[900], fontFamily: f700 }]}>
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
              selectionColor={colors.glass.opaqueBg}
              style={styles.codeInput}
            />
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              label={loading ? t('auth.otp.submitting') : t('auth.otp.submit')}
              onPress={handleVerify}
              fontFamily={f700}
              disabled={!isComplete || loading}
            />

            <View style={styles.resendRow}>
              {purpose === 'login' ? (
                countdown > 0 ? (
                  <Text style={[styles.meta, { color: colors.ink[700], fontFamily: f400 }]}>
                    {t('auth.otp.resendIn', { seconds: countdown })}
                  </Text>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleResend}
                    disabled={resendLoading}
                    style={styles.linkTarget}
                  >
                    <Text style={[styles.link, { color: colors.teal[700], fontFamily: f700 }]}>
                      {resendLoading ? t('common.loading') : t('auth.otp.resend')}
                    </Text>
                  </Pressable>
                )
              ) : (
                <Text style={[styles.meta, { color: colors.ink[700], fontFamily: f400 }]}>
                  {t('auth.otp.registerNoResend')}
                </Text>
              )}
              <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.linkTarget}>
                <Text style={[styles.link, { color: colors.teal[700], fontFamily: f700 }]}>
                  {t('auth.otp.changeNumber')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  header: { alignItems: 'center', marginTop: 24, marginBottom: 28, gap: 14 },
  lockCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  sub: { fontSize: 15, lineHeight: 24, textAlign: 'center' },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
    position: 'relative',
  },
  otpBox: {
    flex: 1,
    maxWidth: 64,
    height: 60,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 24, lineHeight: 32 },
  codeInput: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    color: 'transparent',
    backgroundColor: 'transparent',
    textAlign: 'center',
  },
  actions: { gap: 12 },
  resendRow: { alignItems: 'center' },
  meta: { fontSize: 14, lineHeight: 20, textAlign: 'center', minHeight: 44, textAlignVertical: 'center' },
  linkTarget: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 15, textAlign: 'center' },
});
