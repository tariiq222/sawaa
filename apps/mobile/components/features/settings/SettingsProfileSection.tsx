import React, { useEffect, useState } from 'react';
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
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { splitName } from '@/types/auth';
import { setUser } from '@/stores/slices/auth-slice';
import { AppButton } from '@/components/ui/AppButton';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { useDir } from '@/hooks/useDir';
import { clientProfileService } from '@/services/client';

const SAUDI_PHONE_RE = /^\+966\d{9}$/;

const profileSchema = z.object({
  name: z.string().trim().min(1, 'required'),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || SAUDI_PHONE_RE.test(v), 'invalidPhone'),
  email: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || z.string().email().safeParse(v).success,
      'invalidEmail',
    ),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function SettingsProfileSection() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dir = useDir();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [saving, setSaving] = useState(false);

  const emailReadOnly = Boolean(user?.email);
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
      phone: user?.phone ?? '',
      email: user?.email ?? '',
    },
  });

  useEffect(() => {
    reset({
      name: initialName,
      phone: user?.phone ?? '',
      email: user?.email ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const onSave = handleSubmit(async (values) => {
    if (!user) return;
    setSaving(true);
    try {
      const profile = await clientProfileService.updateProfile({
        name: values.name,
        phone: values.phone ? values.phone : null,
        ...(!emailReadOnly ? { email: values.email || null } : {}),
      });
      const name = profile.name ?? '';
      const { firstName, lastName } = splitName(name);
      const savedValues = { name, phone: profile.phone ?? '', email: profile.email ?? '' };
      dispatch(
        setUser({
          ...user,
          name,
          firstName,
          lastName,
          phone: profile.phone,
          email: profile.email ?? '',
        }),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('settings.profileSaved'));
      reset(savedValues);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('settings.profileSaveError'));
    } finally {
      setSaving(false);
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
      <Controller control={control} name="phone" render={({ field: { value, onChange, onBlur } }) => (
        <LabeledInput label={t('settings.phone')} value={value ?? ''} onChangeText={onChange} onBlur={onBlur}
          keyboardType="phone-pad" error={errorText(errors.phone?.message)} dir={dir}
          inputStyle={{ writingDirection: 'ltr', textAlign: 'left' }} />
      )} />
      <Controller control={control} name="email" render={({ field: { value, onChange, onBlur } }) => (
        <LabeledInput label={t('settings.email')} value={value ?? ''} editable={!emailReadOnly}
          onChangeText={emailReadOnly ? () => undefined : onChange} onBlur={onBlur} keyboardType="email-address"
          autoCapitalize="none" error={errorText(errors.email?.message)} dir={dir}
          inputStyle={{ writingDirection: 'ltr', textAlign: 'left' }} />
      )} />

      {emailReadOnly ? (
        <ThemedText variant="caption" color={theme.colors.textMuted}>
          {t('settings.emailReadOnly')}
        </ThemedText>
      ) : null}

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
