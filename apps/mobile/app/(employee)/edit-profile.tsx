import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AquaBackground, sawaaSpacing } from '@/theme/sawaa';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ErrorState } from '@/components/ui/ErrorState';
import { ThemedText } from '@/theme/components/ThemedText';
import { goBackOrHome } from '@/lib/navigation';
import { useEmployeeProfile, useUpdateEmployeeProfile, useUploadEmployeeAvatar, useRemoveEmployeeAvatar, useRequestEmployeeContact, useVerifyEmployeeContact } from '@/hooks/queries';
import { EmployeeAvatarEditor } from '@/components/features/employee-profile/EmployeeAvatarEditor';
import { EmployeeProfileForm } from '@/components/features/employee-profile/EmployeeProfileForm';
import { EmployeeContactEditor } from '@/components/features/employee-profile/EmployeeContactEditor';

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
  return <AquaBackground><KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}>
      <ScreenHeader title={t('employeeSelfProfile.title')} onBack={() => goBackOrHome(router, '/(employee)/(tabs)/profile')} />
      {profile.isError ? <ErrorState onRetry={() => { void profile.refetch(); }} /> : profile.data ? <>
        <EmployeeAvatarEditor uri={profile.data.avatarUrl} upload={upload.mutateAsync} remove={() => remove.mutateAsync()} busy={busy} />
        <EmployeeProfileForm key={profile.data.id} profile={profile.data} onSave={update.mutateAsync} saving={busy} />
        <View style={styles.contacts}>
          <ThemedText variant="subheading">{t('employeeSelfProfile.contact')}</ThemedText>
          <EmployeeContactEditor channel="EMAIL" currentValue={profile.data.email} request={request.mutateAsync} verify={verify.mutateAsync} busy={busy} />
          <EmployeeContactEditor channel="SMS" currentValue={profile.data.phone} request={request.mutateAsync} verify={verify.mutateAsync} busy={busy} />
        </View>
      </> : <ThemedText>{t('common.loading')}</ThemedText>}
    </ScrollView>
  </KeyboardAvoidingView></AquaBackground>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, content: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.xl }, contacts: { gap: sawaaSpacing.xl } });
