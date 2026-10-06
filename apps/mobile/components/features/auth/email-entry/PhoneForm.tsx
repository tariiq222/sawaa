import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { PrimaryButton } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { PRIVACY_POLICY_URL } from '@/constants/config';
import { SAUDI_PHONE_REGEX } from '@sawaa/shared/validators/phone';
import type { PhoneDetails } from '@/services/email-entry';
// Match common local entry forms before submission; the backend remains the
// authority for international numbering-plan validity and canonicalization.
function hasPhoneFormat(value: string): boolean {
  if (!/^[+\d\s().-]+$/.test(value)) return false;
  let normalized = value.trim().replace(/[\s().-]/g, '').replace(/^00/, '+');
  if (/^0?5\d{8}$/.test(normalized)) {
    return SAUDI_PHONE_REGEX.test(`+966${normalized.replace(/^0/, '')}`);
  }
  if (/^966\d+$/.test(normalized)) normalized = `+${normalized}`;
  // Local Saudi fixed numbers are also accepted by the server normalizer.
  if (/^0?1\d{8}$/.test(normalized)) normalized = `+966${normalized.replace(/^0/, '')}`;
  if (normalized.startsWith('+9665')) return SAUDI_PHONE_REGEX.test(normalized);
  return /^\+[1-9]\d{7,14}$/.test(normalized);
}
export function PhoneForm({ registration, submit, disabled }: { registration: boolean; submit: (details: PhoneDetails) => void; disabled: boolean }) {
  const { t } = useTranslation(); const dir = useDir(); const colors = useSawaaColors();
  const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState(''); const [consent, setConsent] = useState(false);
  const [privacyError, setPrivacyError] = useState(false);
  const validPhone = hasPhoneFormat(phone);
  const firstNameError = firstName.trim().length > 100 ? t('auth.emailEntry.nameTooLong') : undefined;
  const lastNameError = lastName.trim().length > 100 ? t('auth.emailEntry.nameTooLong') : undefined;
  const phoneError = phone.trim() && !validPhone ? t('auth.emailEntry.invalidPhone') : undefined;
  const ready = validPhone && (!registration || Boolean(firstName.trim() && lastName.trim() && !firstNameError && !lastNameError && consent));
  const style = { color: colors.ink[900], fontFamily: getFontName(dir.locale), writingDirection: dir.writingDirection };
  return <View style={{ gap: 16 }}>
    {registration && <>
      <LabeledInput label={t('auth.register.firstName')} value={firstName} onChangeText={setFirstName} error={firstNameError} dir={dir} />
      <LabeledInput label={t('auth.register.lastName')} value={lastName} onChangeText={setLastName} error={lastNameError} dir={dir} />
    </>}
    <LabeledInput label={t('auth.register.phone')} value={phone} onChangeText={setPhone} error={phoneError} keyboardType="phone-pad" dir={dir} />
    {registration && <>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent, disabled }} disabled={disabled} onPress={() => setConsent(v => !v)} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Text style={style}>{consent ? '☑ ' : '☐ '}{t('auth.emailEntry.consent')}</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(PRIVACY_POLICY_URL).catch(() => setPrivacyError(true)); }} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ ...style, color: colors.teal[700] }}>{t('settings.privacyPolicy')}</Text>
      </Pressable>
      {privacyError && <Text style={style}>{t('auth.emailEntry.privacyUnavailable')}</Text>}
    </>}
    <PrimaryButton label={t('auth.emailEntry.sendPhone')} disabled={disabled || !ready} fontFamily={getFontName(dir.locale, '700')} onPress={() => submit(registration ? { phone: phone.trim(), firstName: firstName.trim(), lastName: lastName.trim(), privacyAccepted: true } : { phone: phone.trim() })} />
  </View>;
}
