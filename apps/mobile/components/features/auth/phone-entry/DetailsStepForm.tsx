import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { AppButton } from '@/components/ui/AppButton';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { PRIVACY_POLICY_URL } from '@/constants/config';

export type PhoneRegistrationForm = { firstName: string; lastName: string; email?: string; privacyAccepted: true };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DetailsStepForm({ submit, disabled, pending = false }: {
  submit: (details: PhoneRegistrationForm) => void;
  disabled: boolean;
  pending?: boolean;
}) {
  const { t } = useTranslation(); const dir = useDir(); const colors = useSawaaColors();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [privacyError, setPrivacyError] = useState(false);
  const nameTooLong = (value: string) => value.trim().length > 100;
  const emailInvalid = email.trim() !== '' && !EMAIL_PATTERN.test(email.trim());
  const ready = Boolean(firstName.trim() && lastName.trim() && !nameTooLong(firstName) && !nameTooLong(lastName)
    && !emailInvalid && consent);
  const style = { color: colors.ink[900], fontFamily: getFontName(dir.locale), writingDirection: dir.writingDirection };
  return <View style={{ gap: 16 }}>
    <LabeledInput label={t('auth.register.firstName')} value={firstName} onChangeText={setFirstName} dir={dir}
      error={nameTooLong(firstName) ? t('auth.emailEntry.nameTooLong') : undefined} editable={!disabled} />
    <LabeledInput label={t('auth.register.lastName')} value={lastName} onChangeText={setLastName} dir={dir}
      error={nameTooLong(lastName) ? t('auth.emailEntry.nameTooLong') : undefined} editable={!disabled} />
    <LabeledInput label={t('auth.phoneEntry.emailOptional')} value={email} onChangeText={setEmail} dir={dir}
      error={emailInvalid ? t('auth.phoneEntry.invalidEmail') : undefined} editable={!disabled}
      keyboardType="email-address" textContentType="emailAddress" autoComplete="email" autoCapitalize="none" autoCorrect={false}
      inputStyle={{ writingDirection: 'ltr', textAlign: 'left' }} />
    <Text style={style}>{t('auth.phoneEntry.emailHint')}</Text>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent, disabled }} disabled={disabled}
      onPress={() => setConsent(v => !v)} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={style}>{consent ? '☑ ' : '☐ '}{t('auth.emailEntry.consent')}</Text>
    </Pressable>
    <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(PRIVACY_POLICY_URL).catch(() => setPrivacyError(true)); }}
      style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ ...style, color: colors.teal[700] }}>{t('settings.privacyPolicy')}</Text>
    </Pressable>
    {privacyError && <Text style={style}>{t('auth.emailEntry.privacyUnavailable')}</Text>}
    <AppButton loading={pending} label={t('auth.phoneEntry.createAccount')} disabled={disabled || !ready}
      onPress={() => submit({
        firstName: firstName.trim(), lastName: lastName.trim(),
        ...(email.trim() ? { email: email.trim() } : {}), privacyAccepted: true,
      })} />
  </View>;
}
