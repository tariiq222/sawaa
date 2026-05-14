import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Haptics from 'expo-haptics';
import { User as UserIcon } from 'lucide-react-native';

import { ThemedCard } from '@/theme/components/ThemedCard';
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { setUser } from '@/stores/slices/auth-slice';
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
  const { theme, isRTL } = useTheme();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [saving, setSaving] = useState(false);

  const initialName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
    : '';

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
      await clientProfileService.updateProfile({
        name: values.name,
        phone: values.phone ? values.phone : null,
        email: values.email ? values.email : null,
      });
      const [firstName, ...rest] = values.name.split(/\s+/);
      const lastName = rest.join(' ');
      dispatch(
        setUser({
          ...user,
          firstName: firstName ?? user.firstName,
          lastName: lastName || user.lastName,
          phone: values.phone || null,
          email: values.email || user.email,
        }),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('settings.profileSaved'));
      reset(values);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('settings.profileSaveError'));
    } finally {
      setSaving(false);
    }
  });

  const errorText = (key?: string) => (key ? t(`settings.errors.${key}`) : '');

  return (
    <ThemedCard padding={20} style={{ marginBottom: 16 }}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: '#1D4ED814' }]}>
          <UserIcon size={20} strokeWidth={1.5} color="#1D4ED8" />
        </View>
        <ThemedText variant="subheading">{t('settings.profile')}</ThemedText>
      </View>

      <Field label={t('settings.fullName')} error={errorText(errors.name?.message)}>
        <Controller
          control={control}
          name="name"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('settings.fullNamePlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.input,
                {
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
            />
          )}
        />
      </Field>

      <Field label={t('settings.phone')} error={errorText(errors.phone?.message)}>
        <Controller
          control={control}
          name="phone"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="+9665XXXXXXXX"
              keyboardType="phone-pad"
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.input,
                {
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
            />
          )}
        />
      </Field>

      <Field label={t('settings.email')} error={errorText(errors.email?.message)}>
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.input,
                {
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
            />
          )}
        />
      </Field>

      <Pressable
        onPress={onSave}
        disabled={!isDirty || saving}
        style={({ pressed }) => [
          styles.saveBtn,
          {
            backgroundColor: '#1D4ED8',
            opacity: !isDirty || saving ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText variant="body" color="#fff" style={{ fontWeight: '600' }}>
            {t('settings.saveProfile')}
          </ThemedText>
        )}
      </Pressable>
    </ThemedCard>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <ThemedText
        variant="bodySm"
        color={theme.colors.textSecondary}
        style={{ marginBottom: 6 }}
      >
        {label}
      </ThemedText>
      {children}
      {error ? (
        <ThemedText variant="caption" color={theme.colors.error} style={{ marginTop: 4 }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveBtn: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
