import React from 'react';
import { TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
export function EmailForm({ email, setEmail, submit, disabled }: { email: string; setEmail: (value: string) => void; submit: () => void; disabled: boolean }) {
  const { t } = useTranslation(); const colors = useSawaaColors(); const dir = useDir();
  return <>
    <TextInput accessibilityLabel={t('auth.register.email')} placeholder={t('auth.emailPlaceholder')}
      value={email} onChangeText={setEmail} editable={!disabled} keyboardType="email-address"
      textContentType="emailAddress" autoComplete="email" autoCapitalize="none" autoCorrect={false}
      style={{ minHeight: 56, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, borderColor: colors.teal[200], color: colors.ink[900], backgroundColor: colors.glass.opaqueBg, fontFamily: getFontName(dir.locale), textAlign: 'left' }} />
    <PrimaryButton label={t('auth.emailEntry.sendEmail')} onPress={submit} disabled={disabled} fontFamily={getFontName(dir.locale, '700')} />
  </>;
}
