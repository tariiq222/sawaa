import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppButton } from '@/components/ui/AppButton';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { useDir } from '@/hooks/useDir';

type Props = {
  code: string;
  onCodeChange: (value: string) => void;
  submit: () => void;
  resend: () => void;
  changePhone: () => void;
  pending: boolean;
  expired: boolean;
  retrySeconds: number;
};

export function CodeStepForm({ code, onCodeChange, submit, resend, changePhone, pending, expired, retrySeconds }: Props) {
  const { t } = useTranslation();
  const dir = useDir();
  return <>
    <LabeledInput label={t('auth.phoneEntry.codeLabel')} dir={dir} value={code} onChangeText={onCodeChange}
      keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoComplete="sms-otp"
      editable={!pending && !expired} inputStyle={{ writingDirection: 'ltr', textAlign: 'center', fontSize: 26, letterSpacing: 8 }} />
    <AppButton label={t('auth.phoneEntry.confirm')} onPress={submit} loading={pending}
      disabled={pending || expired || code.length !== 6} />
    <AppButton label={t('auth.phoneEntry.resend')} variant="ghost" size="sm" onPress={resend}
      disabled={pending || retrySeconds > 0 || expired} loading={pending} />
    <AppButton label={t('auth.phoneEntry.changePhone')} variant="ghost" size="sm" onPress={changePhone} disabled={pending} />
  </>;
}
