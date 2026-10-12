import React, { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppButton } from '@/components/ui/AppButton';
import { FloatingActionBar } from '@/components/ui/FloatingActionBar';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { useDir } from '@/hooks/useDir';
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import type { EmployeeSelfProfile, EmployeeProfileUpdate } from '@/services/employee/profile';

const NARROW_WIDTH = 360;
const parseLanguages = (value: string) => [...new Set(value.split(/[,،\n]/).map(v => v.trim()).filter(Boolean))];
const snapshot = (p: EmployeeSelfProfile) => ({ bioAr: (p.bioAr ?? '').trim(), bioEn: (p.bioEn ?? '').trim(), years: p.experience?.toString() ?? '', languages: p.languages });

/** Draft state of the four editable profile fields; `dirty` is true while any differs from the loaded profile. */
export function useEmployeeProfileDraft(profile: EmployeeSelfProfile | undefined, onSave: (data: EmployeeProfileUpdate) => Promise<unknown>) {
  const [bioAr, setBioAr] = useState(profile?.bioAr ?? '');
  const [bioEn, setBioEn] = useState(profile?.bioEn ?? '');
  const [years, setYears] = useState(profile?.experience?.toString() ?? '');
  const [languages, setLanguages] = useState(profile?.languages.join('، ') ?? '');
  const [base, setBase] = useState(profile ? snapshot(profile) : null);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  const id = profile?.id;
  useEffect(() => {
    if (!profile) return;
    setBioAr(profile.bioAr ?? ''); setBioEn(profile.bioEn ?? ''); setYears(profile.experience?.toString() ?? '');
    setLanguages(profile.languages.join('، ')); setFeedback('');
    // Only a different practitioner resets the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { if (profile) setBase(snapshot(profile)); }, [profile]);
  const dirty = Boolean(base) && (bioAr.trim() !== base!.bioAr || bioEn.trim() !== base!.bioEn || years.trim() !== base!.years
    || JSON.stringify(parseLanguages(languages)) !== JSON.stringify(base!.languages));
  const save = async () => {
    const parsedYears = years.trim() ? Number(years) : null;
    const parsedLanguages = parseLanguages(languages);
    setFailed(true);
    if ((parsedYears !== null && (!Number.isInteger(parsedYears) || parsedYears < 0 || parsedYears > 80)) || parsedLanguages.length > 20 || parsedLanguages.some(v => v.length > 60)) {
      setFeedback('employeeSelfProfile.invalidProfile'); return;
    }
    try {
      await onSave({ bioAr: bioAr.trim(), bioEn: bioEn.trim(), experience: parsedYears, languages: parsedLanguages });
      setBase({ bioAr: bioAr.trim(), bioEn: bioEn.trim(), years: years.trim(), languages: parsedLanguages });
      setFailed(false); setFeedback('employeeSelfProfile.saved');
    } catch { setFeedback('employeeSelfProfile.saveError'); }
  };
  return { bioAr, setBioAr, bioEn, setBioEn, years, setYears, languages, setLanguages, feedback, failed, dirty, save };
}
export type EmployeeProfileDraft = ReturnType<typeof useEmployeeProfileDraft>;

export function EmployeeProfileForm({ draft, saving }: { draft: EmployeeProfileDraft; saving: boolean }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dir = useDir();
  const { width } = useWindowDimensions();
  const narrow = width < NARROW_WIDTH;
  return <View style={styles.form}>
    <LabeledInput label={t('employeeSelfProfile.bioAr')} value={draft.bioAr} onChangeText={draft.setBioAr} multiline maxLength={5000} dir={dir} disabled={saving} inputStyle={styles.bio} />
    <LabeledInput label={t('employeeSelfProfile.bioEn')} value={draft.bioEn} onChangeText={draft.setBioEn} multiline maxLength={5000} dir={dir} disabled={saving} inputStyle={[styles.bio, { textAlign: 'left', writingDirection: 'ltr' }]} />
    <View style={[styles.pair, { flexDirection: narrow ? 'column' : dir.row }]}>
      <View style={narrow ? undefined : styles.narrowField}>
        <LabeledInput label={t('employeeSelfProfile.experience')} value={draft.years} onChangeText={draft.setYears} keyboardType="number-pad" dir={dir} disabled={saving} maxLength={2} />
      </View>
      <View style={narrow ? undefined : styles.wideField}>
        <LabeledInput label={t('employeeSelfProfile.languages')} value={draft.languages} onChangeText={draft.setLanguages} dir={dir} disabled={saving} placeholder={t('employeeSelfProfile.languagesHint')} maxLength={1250} />
      </View>
    </View>
    {draft.feedback ? <ThemedText accessibilityRole={draft.failed ? 'alert' : undefined} accessibilityLiveRegion="polite" color={draft.failed ? theme.colors.error : undefined}>{t(draft.feedback)}</ThemedText> : null}
  </View>;
}

/** Pinned save bar; rendered only while the draft differs from the loaded profile. */
export function EmployeeProfileSaveBar({ draft, saving }: { draft: EmployeeProfileDraft; saving: boolean }) {
  const { t } = useTranslation();
  if (!draft.dirty) return null;
  return <FloatingActionBar>
    <ThemedText variant="bodySm" style={styles.barText}>{t('employeeSelfProfile.unsavedChanges')}</ThemedText>
    <AppButton label={t('common.save')} onPress={draft.save} loading={saving} />
  </FloatingActionBar>;
}
const styles = StyleSheet.create({
  form: { gap: 16 }, bio: { minHeight: 110, textAlignVertical: 'top' },
  pair: { gap: 12 }, narrowField: { flex: 1 }, wideField: { flex: 2 }, barText: { flex: 1 },
});
