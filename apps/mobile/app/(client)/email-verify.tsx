import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SettingsScaffold } from '@/components/features/settings/SettingsScaffold';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { AppButton } from '@/components/ui/AppButton';
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { useDir } from '@/hooks/useDir';
import {
  useClientEmailStatus,
  useDeclineClientEmail,
  useRequestClientEmail,
  useVerifyClientEmail,
} from '@/hooks/queries';
import { clientEmailError } from '@/services/client-email';
import { snoozeClientEmailPromptForSession } from '@/features/auth/client-email-prompt';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * One screen for both the one-time "add your email" prompt and the account
 * row. Email is only trusted after a code; the field is never prefilled with
 * a legacy unverified address (the API never returns one). The challenge
 * secret lives in component memory only.
 */
export default function EmailVerifyScreen() {
  const { mode } = useLocalSearchParams<{ mode?: 'prompt' | 'manage' }>();
  const isPrompt = mode !== 'manage';
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dir = useDir();
  const router = useRouter();
  const status = useClientEmailStatus();
  const requestMutation = useRequestClientEmail();
  const verifyMutation = useVerifyClientEmail();
  const declineMutation = useDeclineClientEmail();
  const [step, setStep] = useState<'enter' | 'code' | 'done'>('enter');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [retryAt, setRetryAt] = useState(0);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const leaving = useRef(false);
  const pending = requestMutation.isPending || verifyMutation.isPending || declineMutation.isPending;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // A pending address is the client's own unconfirmed input; prefill it.
  useEffect(() => {
    if (status.data?.status === 'pending' && status.data.pendingEmail && step === 'enter') {
      setEmail(status.data.pendingEmail);
    }
  }, [status.data?.status, status.data?.pendingEmail, step]);
  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    router.back();
  };
  useEffect(() => {
    if (step !== 'done') return;
    const timer = setTimeout(leave, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const retrySeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const expired = expiresAt > 0 && now >= expiresAt;
  const applyError = (failure: unknown) => {
    const recovery = clientEmailError(failure);
    setError(recovery.key);
    if (recovery.retryAfterSeconds) setRetryAt(Date.now() + recovery.retryAfterSeconds * 1000);
    if (recovery.key === 'invalidCode') setCode('');
  };
  const send = async () => {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) { setError('invalidEmail'); return; }
    if (Date.now() < retryAt) return;
    setError('');
    try {
      const result = await requestMutation.mutateAsync({ email: trimmed });
      setChallengeId(result.challengeId);
      setMaskedEmail(result.maskedEmail);
      setCode('');
      setExpiresAt(Date.now() + result.expiresIn * 1000);
      setRetryAt(Date.now() + result.retryAfterSeconds * 1000);
      setStep('code');
    } catch (failure) { applyError(failure); }
  };
  const confirm = async () => {
    if (code.length !== 6 || expired) return;
    setError('');
    try {
      await verifyMutation.mutateAsync({ challengeId, code });
      setStep('done');
    } catch (failure) { applyError(failure); }
  };
  const decline = async () => {
    setError('');
    try {
      await declineMutation.mutateAsync();
      leave();
    } catch (failure) { applyError(failure); }
  };
  const later = () => {
    snoozeClientEmailPromptForSession();
    leave();
  };
  const title = step === 'code' ? t('profile.email.codeTitle')
    : status.data?.status === 'pending' ? t('profile.email.confirmTitle') : t('profile.email.addTitle');
  return <SettingsScaffold title={title} keyboardSafe>
    {step === 'enter' && <>
      <ThemedText variant="body">{t('profile.email.intro')}</ThemedText>
      <LabeledInput label={t('profile.email.label')} value={email} onChangeText={value => { setEmail(value); setError(''); }}
        dir={dir} keyboardType="email-address" textContentType="emailAddress" autoComplete="email"
        autoCapitalize="none" autoCorrect={false} editable={!pending}
        inputStyle={{ writingDirection: 'ltr', textAlign: 'left' }} />
      <AppButton label={t('profile.email.sendCode')} onPress={() => { void send(); }}
        loading={pending} disabled={pending || retrySeconds > 0} />
      {isPrompt && <View style={{ gap: 8 }}>
        <AppButton label={t('profile.email.decline')} variant="ghost" size="sm" onPress={() => { void decline(); }} disabled={pending} loading={pending} />
        <AppButton label={t('profile.email.later')} variant="ghost" size="sm" onPress={later} disabled={pending} />
      </View>}
    </>}
    {step === 'code' && <>
      <ThemedText variant="body">{t('profile.email.codeSentTo', { email: maskedEmail })}</ThemedText>
      <LabeledInput label={t('profile.email.codeLabel')} dir={dir} value={code}
        onChangeText={value => { setCode(value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
        keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoComplete="one-time-code"
        editable={!pending && !expired}
        inputStyle={{ writingDirection: 'ltr', textAlign: 'center', fontSize: 26, letterSpacing: 8 }} />
      {expired && <ThemedText accessibilityRole="alert">{t('profile.email.expiredCode')}</ThemedText>}
      <AppButton label={t('profile.email.confirm')} onPress={() => { void confirm(); }} loading={pending}
        disabled={pending || expired || code.length !== 6} />
      <AppButton label={t('profile.email.resend')} variant="ghost" size="sm" onPress={() => { void send(); }}
        disabled={pending || retrySeconds > 0 || expired} loading={pending} />
    </>}
    {step === 'done' && <ThemedText accessibilityRole="alert">{t('profile.email.verified')}</ThemedText>}
    {error && <ThemedText accessibilityRole="alert" color={theme.colors.error}>{t(`profile.email.${error}`)}</ThemedText>}
    {retrySeconds > 0 && step === 'code' && <ThemedText>{t('auth.otp.resendIn', { seconds: retrySeconds })}</ThemedText>}
  </SettingsScaffold>;
}
