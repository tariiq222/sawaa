import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppButton } from '@/components/ui/AppButton';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { useDir } from '@/hooks/useDir';
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import type { EmployeeSelfProfile, EmployeeProfileUpdate } from '@/services/employee/profile';

export function EmployeeProfileForm({ profile, onSave, saving }: { profile: EmployeeSelfProfile; onSave: (data: EmployeeProfileUpdate) => Promise<unknown>; saving: boolean }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dir = useDir();
  const [bioAr, setBioAr] = useState(profile.bioAr ?? '');
  const [bioEn, setBioEn] = useState(profile.bioEn ?? '');
  const [years, setYears] = useState(profile.experience?.toString() ?? '');
  const [languages, setLanguages] = useState(profile.languages.join('، '));
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  const save = async () => {
    const parsedYears = years.trim() ? Number(years) : null;
    const parsedLanguages = [...new Set(languages.split(/[,،\n]/).map(v => v.trim()).filter(Boolean))];
    setFailed(true);
    if ((parsedYears !== null && (!Number.isInteger(parsedYears) || parsedYears < 0 || parsedYears > 80)) || parsedLanguages.length > 20 || parsedLanguages.some(v => v.length > 60)) {
      setFeedback('employeeSelfProfile.invalidProfile'); return;
    }
    try {
      await onSave({ bioAr: bioAr.trim(), bioEn: bioEn.trim(), experience: parsedYears, languages: parsedLanguages });
      setFailed(false); setFeedback('employeeSelfProfile.saved');
    } catch { setFeedback('employeeSelfProfile.saveError'); }
  };
  return <View style={styles.form}>
    <ThemedText variant="subheading">{t('employeeSelfProfile.professional')}</ThemedText>
    <LabeledInput label={t('employeeSelfProfile.bioAr')} value={bioAr} onChangeText={setBioAr} multiline maxLength={5000} dir={dir} disabled={saving} inputStyle={styles.bio} />
    <LabeledInput label={t('employeeSelfProfile.bioEn')} value={bioEn} onChangeText={setBioEn} multiline maxLength={5000} dir={dir} disabled={saving} inputStyle={[styles.bio, { textAlign: 'left', writingDirection: 'ltr' }]} />
    <LabeledInput label={t('employeeSelfProfile.experience')} value={years} onChangeText={setYears} keyboardType="number-pad" dir={dir} disabled={saving} maxLength={2} />
    <LabeledInput label={t('employeeSelfProfile.languages')} value={languages} onChangeText={setLanguages} dir={dir} disabled={saving} placeholder={t('employeeSelfProfile.languagesHint')} maxLength={1250} />
    {feedback ? <ThemedText accessibilityRole={failed ? 'alert' : undefined} accessibilityLiveRegion="polite" color={failed ? theme.colors.error : undefined}>{t(feedback)}</ThemedText> : null}
    <AppButton label={t('common.save')} onPress={save} loading={saving} />
  </View>;
}
const styles = StyleSheet.create({ form: { gap: 16 }, bio: { minHeight: 110, textAlignVertical: 'top' } });
