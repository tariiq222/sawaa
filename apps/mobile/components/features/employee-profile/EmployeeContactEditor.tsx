import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AppButton } from '@/components/ui/AppButton';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { useDir } from '@/hooks/useDir';
import { hasPhoneFormat } from '@/lib/phone-format';
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import type { ContactChallenge, ContactRequest, ContactVerification } from '@/services/employee/profile';
import { profileError } from './profile-error';

type Pending = ContactChallenge & { expiresAt: number; retryAt: number };
export function EmployeeContactEditor({ channel, currentValue, request, verify, busy }: {
  channel: 'EMAIL' | 'SMS'; currentValue: string | null; request: (input: ContactRequest) => Promise<ContactChallenge>;
  verify: (input: ContactVerification) => Promise<unknown>; busy: boolean;
}) {
  const { t } = useTranslation();
  const dir = useDir();
  const { theme } = useTheme();
  const [value, setValue] = useState(currentValue ?? '');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setValue(currentValue ?? ''); setPending(null); setCode(''); }, [currentValue]);
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);
  const send = async () => {
    setError(''); setSaved(false);
    if (channel === 'EMAIL' ? !z.string().email().safeParse(value.trim()).success : !hasPhoneFormat(value.trim())) { setError('employeeSelfProfile.invalidContact'); return; }
    try {
      const result = await request({ channel, identifier: value.trim() });
      const startedAt = Date.now();
      setNow(startedAt); setCode('');
      setPending({ ...result, expiresAt: startedAt + result.expiresIn * 1000, retryAt: startedAt + result.retryAfterSeconds * 1000 });
    } catch (e) { setError(profileError(e, 'employeeSelfProfile.contactError')); }
  };
  const confirm = async () => {
    if (!pending || !/^\d{6}$/.test(code)) { setError('employeeSelfProfile.invalidCode'); return; }
    setError('');
    try { await verify({ challengeId: pending.challengeId, code }); setPending(null); setCode(''); setSaved(true); }
    catch (e) { setError(profileError(e, 'employeeSelfProfile.contactError')); }
  };
  const retryAfter = pending ? Math.max(0, Math.ceil((pending.retryAt - now) / 1000)) : 0;
  const expired = pending ? now >= pending.expiresAt : false;
  return <View style={styles.form}>
    <LabeledInput label={t(channel === 'EMAIL' ? 'settings.email' : 'settings.phone')} value={value} onChangeText={setValue} dir={dir}
      keyboardType={channel === 'EMAIL' ? 'email-address' : 'phone-pad'} autoCapitalize="none" autoCorrect={false} editable={!pending && !busy}
      inputStyle={{ textAlign: 'left', writingDirection: 'ltr' }} maxLength={254} />
    <ThemedText variant="caption">{t('employeeSelfProfile.contactHint')}</ThemedText>
    {pending ? <>
      <ThemedText>{t(expired ? 'employeeSelfProfile.expired' : 'employeeSelfProfile.codeSent')}</ThemedText>
      <LabeledInput label={t('employeeSelfProfile.code')} value={code} onChangeText={setCode} dir={dir} keyboardType="number-pad" maxLength={6}
        autoComplete="one-time-code" textContentType="oneTimeCode" disabled={busy || expired} inputStyle={{ textAlign: 'left', writingDirection: 'ltr' }} />
      <AppButton label={t('employeeSelfProfile.confirmContact')} onPress={confirm} loading={busy} disabled={expired || !/^\d{6}$/.test(code)} />
      <AppButton label={retryAfter ? t('employeeSelfProfile.resendAfter', { seconds: retryAfter }) : t('employeeSelfProfile.resend')} onPress={send} variant="secondary" disabled={busy || retryAfter > 0} />
      <AppButton label={t('employeeSelfProfile.changeTarget')} onPress={() => { setPending(null); setCode(''); setError(''); }} variant="ghost" disabled={busy} />
    </> : <AppButton label={t('employeeSelfProfile.sendCode')} onPress={send} loading={busy} disabled={!value.trim() || value.trim() === (currentValue ?? '')} variant="secondary" />}
    {error ? <ThemedText accessibilityRole="alert" color={theme.colors.error}>{t(error)}</ThemedText> : null}
    {saved ? <ThemedText accessibilityLiveRegion="polite">{t('employeeSelfProfile.contactSaved')}</ThemedText> : null}
  </View>;
}
const styles = StyleSheet.create({ form: { gap: 12 } });
