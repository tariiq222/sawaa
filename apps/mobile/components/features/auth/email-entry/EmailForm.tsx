import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppButton } from '@/components/ui/AppButton';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { useDir } from '@/hooks/useDir';
export function EmailForm({ email, setEmail, submit, disabled, pending = false }: { email: string; setEmail: (value: string) => void; submit: () => void; disabled: boolean; pending?: boolean }) {
  const { t } = useTranslation(); const dir = useDir();
  return <>
    <LabeledInput label={t('auth.register.email')} placeholder={t('auth.emailPlaceholder')} dir={dir}
      value={email} onChangeText={setEmail} editable={!disabled} keyboardType="email-address"
      textContentType="emailAddress" autoComplete="email" autoCapitalize="none" autoCorrect={false}
      inputStyle={{ writingDirection: 'ltr', textAlign: 'left' }} />
    <AppButton loading={pending} label={t('auth.emailEntry.sendEmail')} onPress={submit} disabled={disabled} />
  </>;
}
