import React from 'react';
import { TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PrimaryButton } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
export function CodeForm({ code, setCode, submit, pending, expired, phone }: { code: string; setCode: (v: string) => void; submit: () => void; pending: boolean; expired: boolean; phone: boolean }) {
  const { t } = useTranslation(); const colors = useSawaaColors(); const dir = useDir();
  return <>
    <TextInput accessibilityLabel={t('auth.emailEntry.code')} value={code} onChangeText={setCode}
      keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoComplete={phone ? 'sms-otp' : 'one-time-code'}
      editable={!pending && !expired} style={{ minHeight: 64, fontSize: 26, letterSpacing: 12, textAlign: 'center', color: colors.ink[900], backgroundColor: colors.glass.opaqueBg, borderRadius: 16 }} />
    <PrimaryButton label={t('auth.otp.submit')} onPress={submit} disabled={pending || expired || code.length !== 6} fontFamily={getFontName(dir.locale, '700')} />
  </>;
}
