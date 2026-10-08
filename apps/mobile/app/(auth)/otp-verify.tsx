import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  Text,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AuthFormScaffold } from '@/components/features/auth/AuthFormScaffold';
import { sawaaType, sawaaRadius } from '@/theme/sawaa/tokens';
import { AppButton } from '@/components/ui/AppButton';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useAppDispatch } from '@/hooks/use-redux';
import { useVerifyOtp, useRequestLoginOtp, useRegister } from '@/hooks/queries';
import { SessionSupersededError } from '@/services/auth';
import { completeNativeSession } from '@/features/auth/complete-native-session';
import { isSessionCurrent } from '@/services/native-session-state';

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
    redirect?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }>();
  const {
    identifier = '',
    purpose = 'register',
    maskedIdentifier = '',
    firstName = '',
    lastName = '',
    email = '',
  } = params;
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
  const register = useRegister();

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
      await completeNativeSession(result, {
        dispatch, replace: router.replace, booking: params.booking, redirect: params.redirect,
      });
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
    setResendLoading(true);
    try {
      if (purpose === 'login') {
        await requestLoginOtp.mutateAsync({ identifier });
      } else {
        // Re-submitting the same registration re-sends the register OTP for a
        // signup that has not been verified yet.
        await register.mutateAsync({ firstName, lastName, phone: identifier, email });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCountdown(RESEND_COOLDOWN);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.error.generic'));
    } finally {
      setResendLoading(false);
    }
  }, [purpose, identifier, firstName, lastName, email, requestLoginOtp, register, t]);

  // Auto-submit when all digits are filled
  useEffect(() => {
    if (otp.length === OTP_LENGTH && !loading) {
      handleVerify();
    }
  }, [otp, handleVerify, loading]);

  const isComplete = otp.length === OTP_LENGTH;

  return (
    <AuthFormScaffold title={t('auth.otp.title')} onBack={() => router.back()}>
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
      <AppButton
        label={t('auth.otp.submit')}
        onPress={handleVerify}
        disabled={!isComplete || loading} loading={loading}
      />

      <View style={styles.resendRow}>
        {countdown > 0 ? (
          <Text style={[styles.meta, { color: colors.ink[700], fontFamily: f400 }]}>
            {t('auth.otp.resendIn', { seconds: countdown })}
          </Text>
        ) : (
          <AppButton label={t('auth.otp.resend')} variant="ghost" size="sm" onPress={handleResend} disabled={resendLoading} loading={resendLoading} />
        )}
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.linkTarget}>
          <Text style={[styles.link, { color: colors.teal[700], fontFamily: f700 }]}>
            {t('auth.otp.changeNumber')}
          </Text>
        </Pressable>
      </View>
    </View>

  </AuthFormScaffold>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginTop: 24, marginBottom: 28, gap: 14 },
  lockCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  sub: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, textAlign: 'center' },
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
    minHeight: 60,
    paddingVertical: 12,
    borderRadius: sawaaRadius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  codeInput: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    color: 'transparent',
    backgroundColor: 'transparent',
    textAlign: 'center',
  },
  actions: { gap: 12 },
  resendRow: { alignItems: 'center' },
  meta: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, textAlign: 'center', minHeight: 44, textAlignVertical: 'center' },
  linkTarget: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, textAlign: 'center' },
});
