import React, { useEffect } from 'react';
import {
  Alert,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Haptics from 'expo-haptics';

import { User } from 'lucide-react-native';

import { withAlpha } from '@/theme/sawaa';
import { useTheme } from '@/theme/useTheme';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { splitName } from '@/types/auth';
import { setUser } from '@/stores/slices/auth-slice';
import { AppButton } from '@/components/ui/AppButton';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { useDir } from '@/hooks/useDir';
import { useUpdateClientProfile } from '@/hooks/queries/useClientProfile';
import { ClientEmailRow } from '@/components/features/settings/ClientEmailRow';
import { ClientPhoneRow } from '@/components/features/settings/ClientPhoneRow';

const profileSchema = z.object({
  name: z.string().trim().min(1, 'required'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function SettingsProfileSection() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dir = useDir();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const updateProfile = useUpdateClientProfile();
  const saving = updateProfile.isPending;

  const initialName = user?.name ?? (user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
    : '');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initialName,
    },
  });

  useEffect(() => {
    reset({
      name: initialName,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const onSave = handleSubmit(async (values) => {
    if (!user) return;
    try {
      // Email changes go through the code-verified email flow, and phone
      // changes through the SMS-verified phone flow — never this form.
      const profile = await updateProfile.mutateAsync({
        name: values.name,
      });
      const name = profile.name ?? '';
      const { firstName, lastName } = splitName(name);
      const savedValues = { name };
      dispatch(
        setUser({
          ...user,
          name,
          firstName,
          lastName,
          phone: profile.phone,
        }),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('settings.profileSaved'));
      reset(savedValues);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('settings.profileSaveError'));
    }
  });

  const errorText = (key?: string) => (key ? t(`settings.errors.${key}`) : '');
  return (
    <View style={styles.form}>
      <View style={[styles.avatar, { backgroundColor: withAlpha(theme.colors.primary, 0.12) }]}>
        <User size={44} color={theme.colors.primary} strokeWidth={1.75} />
      </View>

      <Controller control={control} name="name" render={({ field: { value, onChange, onBlur } }) => (
        <LabeledInput label={t('settings.fullName')} value={value} onChangeText={onChange} onBlur={onBlur}
          placeholder={t('settings.fullNamePlaceholder')} error={errorText(errors.name?.message)} dir={dir} />
      )} />

      <ClientPhoneRow />
      <ClientEmailRow />

      <AppButton label={t('settings.saveProfile')} onPress={onSave} loading={saving} disabled={!isDirty || saving} />
    </View>
  );
}
const styles = StyleSheet.create({
  form: { gap: 16, marginBottom: 8 },
  avatar: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
