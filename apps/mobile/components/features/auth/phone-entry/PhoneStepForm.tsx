import React from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppButton } from '@/components/ui/AppButton';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { useDir } from '@/hooks/useDir';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getFontName } from '@/theme/fonts';
import { sawaaType } from '@/theme/sawaa/tokens';

type Props = {
  phone: string;
  onPhoneChange: (value: string) => void;
  submit: () => void;
  pending: boolean;
  onEmailEntry: () => void;
  onStaffLogin: () => void;
};

export function PhoneStepForm({ phone, onPhoneChange, submit, pending, onEmailEntry, onStaffLogin }: Props) {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const link: TextStyle = { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight, color: colors.teal[700], textAlign: 'center', writingDirection: dir.writingDirection };
  return <View style={styles.wrap}>
    <LabeledInput label={t('auth.phoneEntry.phoneLabel')} value={phone} onChangeText={onPhoneChange} dir={dir}
      keyboardType="phone-pad" autoCorrect={false} autoComplete="tel" textContentType="telephoneNumber"
      editable={!pending} inputStyle={{ textAlign: 'left', writingDirection: 'ltr' }} />
    <AppButton label={t('auth.phoneEntry.continue')} onPress={submit} loading={pending} disabled={pending} />
    <Pressable accessibilityRole="link" onPress={onEmailEntry} style={styles.linkTarget}>
      <Text style={[link, { fontFamily: getFontName(dir.locale, '600') }]}>{t('auth.phoneEntry.emailLoginLink')}</Text>
    </Pressable>
    <Pressable accessibilityRole="link" onPress={onStaffLogin} style={styles.linkTarget}>
      <Text style={link}>{t('auth.phoneEntry.staffLoginLink')}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  linkTarget: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
});
