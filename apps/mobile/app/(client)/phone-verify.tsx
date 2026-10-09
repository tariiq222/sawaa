import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { clientProfileKeys } from '@/hooks/queries/useClientProfile';
import { SettingsScaffold } from '@/components/features/settings/SettingsScaffold';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { AppButton } from '@/components/ui/AppButton';
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { useDir } from '@/hooks/useDir';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { useRequestClientPhone, useVerifyClientPhone } from '@/hooks/queries';
import { clientPhoneError, type ClientPhoneVerification } from '@/services/client-phone';
import { normalizeSaudiMobile } from '@/lib/phone-format';
import { setToken, setUser } from '@/stores/slices/auth-slice';
import {
  getSessionEpoch,
  isSessionCurrent,
  persistSessionTokensAtEpoch,
} from '@/services/native-session-state';

/**
 * Changing the phone number requires an SMS code sent to the NEW number.
 * The server then closes all other sessions and issues fresh tokens for this
 * device; they are stored epoch-fenced so a logout that raced the request can
 * never be resurrected. The challenge id, the code and the tokens live in
 * component memory only.
 */
export default function PhoneVerifyScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dir = useDir();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const user = useAppSelector((state) => state.auth.user);
  const requestMutation = useRequestClientPhone();
  const verifyMutation = useVerifyClientPhone();
  const [step, setStep] = useState<'enter' | 'code' | 'done'>('enter');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [retryAt, setRetryAt] = useState(0);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const leaving = useRef(false);
  const pending = requestMutation.isPending || verifyMutation.isPending;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
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
    const recovery = clientPhoneError(failure);
    setError(recovery.key);
    if (recovery.retryAfterSeconds) setRetryAt(Date.now() + recovery.retryAfterSeconds * 1000);
    if (recovery.key === 'invalidCode') setCode('');
  };
  const send = async () => {
    const normalized = normalizeSaudiMobile(phone);
    if (!normalized) { setError('invalidPhone'); return; }
    if (Date.now() < retryAt) return;
    setError('');
    try {
      const result = await requestMutation.mutateAsync({ phone: normalized });
      setChallengeId(result.challengeId);
      setMaskedPhone(result.maskedPhone);
      setCode('');
      setExpiresAt(Date.now() + result.expiresIn * 1000);
      setRetryAt(Date.now() + result.retryAfterSeconds * 1000);
      setStep('code');
    } catch (failure) { applyError(failure); }
  };
  const adoptSession = async (result: ClientPhoneVerification, epoch: number) => {
    // The epoch is captured before the request; a logout or a newer login that
    // raced it must win, and the fresh tokens must never be written.
    if (!isSessionCurrent(epoch)) { leave(); return; }
    const persisted = await persistSessionTokensAtEpoch(result.tokens, epoch);
    if (!persisted || !isSessionCurrent(epoch)) { leave(); return; }
    dispatch(setToken(result.tokens.accessToken));
    if (user) dispatch(setUser({ ...user, phone: result.phone }));
    // Only now may cached reads refetch: the old tokens were revoked server-side.
    void queryClient.invalidateQueries({ queryKey: clientProfileKeys.all });
    setStep('done');
  };
  const confirm = async () => {
    if (code.length !== 6 || expired) return;
    setError('');
    const epoch = getSessionEpoch();
    try {
      const result = await verifyMutation.mutateAsync({ challengeId, code });
      await adoptSession(result, epoch);
    } catch (failure) { applyError(failure); }
  };
  const editPhone = () => {
    setError('');
    setCode('');
    setExpiresAt(0);
    setStep('enter');
  };
  return <SettingsScaffold title={t('profile.phone.title')} keyboardSafe>
    {step === 'enter' && <>
      <ThemedText variant="body">{t('profile.phone.intro')}</ThemedText>
      <LabeledInput label={t('profile.phone.newPhoneLabel')} value={phone} onChangeText={value => { setPhone(value); setError(''); }}
        dir={dir} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel"
        autoCorrect={false} editable={!pending}
        inputStyle={{ writingDirection: 'ltr', textAlign: 'left' }} />
      <AppButton label={t('profile.phone.sendCode')} onPress={() => { void send(); }}
        loading={pending} disabled={pending || retrySeconds > 0} />
    </>}
    {step === 'code' && <>
      <ThemedText variant="body">{t('profile.phone.codeSentTo', { phone: maskedPhone })}</ThemedText>
      <LabeledInput label={t('profile.phone.codeLabel')} dir={dir} value={code}
        onChangeText={value => { setCode(value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
        keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoComplete="sms-otp"
        editable={!pending && !expired}
        inputStyle={{ writingDirection: 'ltr', textAlign: 'center', fontSize: 26, letterSpacing: 8 }} />
      {expired && <ThemedText accessibilityRole="alert">{t('profile.phone.expiredCode')}</ThemedText>}
      <AppButton label={t('profile.phone.confirm')} onPress={() => { void confirm(); }} loading={pending}
        disabled={pending || expired || code.length !== 6} />
      <AppButton label={t('profile.phone.resend')} variant="ghost" size="sm" onPress={() => { void send(); }}
        disabled={pending || retrySeconds > 0 || expired} loading={pending} />
      <AppButton label={t('profile.phone.editPhone')} variant="ghost" size="sm" onPress={editPhone} disabled={pending} />
    </>}
    {step === 'done' && <ThemedText accessibilityRole="alert">{t('profile.phone.changed')}</ThemedText>}
    {error && <ThemedText accessibilityRole="alert" color={theme.colors.error}>{t(`profile.phone.${error}`)}</ThemedText>}
    {retrySeconds > 0 && step === 'code' && <ThemedText>{t('auth.otp.resendIn', { seconds: retrySeconds })}</ThemedText>}
  </SettingsScaffold>;
}
