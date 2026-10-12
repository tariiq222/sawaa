import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AquaBackground, sawaaRadius, sawaaSpacing } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ErrorState } from '@/components/ui/ErrorState';
import { ThemedText } from '@/theme/components/ThemedText';
import { goBackOrHome } from '@/lib/navigation';
import { useEmployeeProfile, useUpdateEmployeeProfile, useUploadEmployeeAvatar, useRemoveEmployeeAvatar, useRequestEmployeeContact, useVerifyEmployeeContact } from '@/hooks/queries';
import { EmployeeAvatarEditor } from '@/components/features/employee-profile/EmployeeAvatarEditor';
import { EmployeeProfileForm, EmployeeProfileSaveBar, useEmployeeProfileDraft } from '@/components/features/employee-profile/EmployeeProfileForm';
import { EmployeeContactRow } from '@/components/features/employee-profile/EmployeeContactRow';

const SAVE_BAR_SPACE = 120;

export default function EditEmployeeProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useEmployeeProfile();
  const update = useUpdateEmployeeProfile();
  const upload = useUploadEmployeeAvatar();
  const remove = useRemoveEmployeeAvatar();
  const request = useRequestEmployeeContact();
  const verify = useVerifyEmployeeContact();
  const busy = update.isPending || upload.isPending || remove.isPending || request.isPending || verify.isPending;
  const draft = useEmployeeProfileDraft(profile.data, update.mutateAsync);
  const data = profile.data;
  return <AquaBackground><KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + (draft.dirty ? SAVE_BAR_SPACE : 40) }]}>
      <ScreenHeader title={t('employeeSelfProfile.title')} onBack={() => goBackOrHome(router, '/(employee)/(tabs)/profile')} />
      {profile.isError ? <ErrorState onRetry={() => { void profile.refetch(); }} /> : data ? <>
        <Glass variant="strong" radius={sawaaRadius.lg} padding={sawaaSpacing.lg}>
          <EmployeeAvatarEditor uri={data.avatarUrl} name={data.name} upload={upload.mutateAsync} remove={() => remove.mutateAsync()} busy={busy} />
        </Glass>
        <Glass variant="strong" radius={sawaaRadius.lg} padding={sawaaSpacing.lg}>
          <View style={styles.card}>
            <SectionHeader title={t('employeeSelfProfile.professional')} />
            <EmployeeProfileForm draft={draft} saving={busy} />
          </View>
        </Glass>
        <Glass variant="strong" radius={sawaaRadius.lg} padding={sawaaSpacing.lg}>
          <View style={styles.card}>
            <SectionHeader title={t('employeeSelfProfile.contact')} />
            <EmployeeContactRow channel="EMAIL" currentValue={data.email} request={request.mutateAsync} verify={verify.mutateAsync} busy={busy} />
            <EmployeeContactRow channel="SMS" currentValue={data.phone} request={request.mutateAsync} verify={verify.mutateAsync} busy={busy} />
          </View>
        </Glass>
      </> : <ThemedText>{t('common.loading')}</ThemedText>}
    </ScrollView>
    <EmployeeProfileSaveBar draft={draft} saving={busy} />
  </KeyboardAvoidingView></AquaBackground>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, content: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg }, card: { gap: sawaaSpacing.lg } });
