import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppButton } from '@/components/ui/AppButton';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { useDir } from '@/hooks/useDir';
export function CodeForm({ code, setCode, submit, pending, expired, phone }: { code: string; setCode: (v: string) => void; submit: () => void; pending: boolean; expired: boolean; phone: boolean }) {
  const { t } = useTranslation(); const dir = useDir();
  return <>
    <LabeledInput label={t('auth.emailEntry.code')} dir={dir} value={code} onChangeText={setCode}
      keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoComplete={phone ? 'sms-otp' : 'one-time-code'}
      editable={!pending && !expired} inputStyle={{ writingDirection: 'ltr', textAlign: 'center', fontSize: 26, letterSpacing: 8 }} />
    <AppButton label={t('auth.otp.submit')} onPress={submit} loading={pending} disabled={pending || expired || code.length !== 6} />
  </>;
}
