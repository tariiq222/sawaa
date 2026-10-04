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

import { User } from 'lucide-react-native';

import { sawaaRadius, withAlpha } from '@/theme/sawaa';
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { splitName } from '@/types/auth';
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
  const inputStyle = (hasError: boolean) => [
    styles.input,
    {
      color: theme.colors.textPrimary,
      borderColor: hasError ? theme.colors.error : theme.colors.border,
      backgroundColor: theme.colors.surface,
      textAlign: isRTL ? ('right' as const) : ('left' as const),
    },
  ];

  return (
    <View style={styles.form}>
      <View style={[styles.avatar, { backgroundColor: withAlpha(theme.colors.primary, 0.12) }]}>
        <User size={44} color={theme.colors.primary} strokeWidth={1.75} />
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
              accessibilityLabel={t('settings.fullName')}
              placeholder={t('settings.fullNamePlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              style={inputStyle(Boolean(errors.name))}
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
              accessibilityLabel={t('settings.phone')}
              placeholder="+9665XXXXXXXX"
              keyboardType="phone-pad"
              placeholderTextColor={theme.colors.textMuted}
              style={inputStyle(Boolean(errors.phone))}
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
              editable={!emailReadOnly}
              onChangeText={emailReadOnly ? undefined : onChange}
              onBlur={onBlur}
              accessibilityLabel={t('settings.email')}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={theme.colors.textMuted}
              style={inputStyle(Boolean(errors.email))}
            />
          )}
        />
      </Field>

      {emailReadOnly ? (
        <ThemedText variant="caption" color={theme.colors.textMuted}>
          {t('settings.emailReadOnly')}
        </ThemedText>
      ) : null}

      <Pressable
        onPress={onSave}
        disabled={!isDirty || saving}
        accessibilityRole="button"
        accessibilityState={{ disabled: !isDirty || saving }}
        style={({ pressed }) => [
          styles.saveBtn,
          {
            backgroundColor: theme.colors.primaryFill,
            opacity: !isDirty || saving ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {saving ? (
          <ActivityIndicator color={theme.colors.primaryForeground} />
        ) : (
          <ThemedText variant="body" color={theme.colors.primaryForeground} style={{ fontWeight: '700', fontSize: 17 }}>
            {t('settings.saveProfile')}
          </ThemedText>
        )}
      </Pressable>
    </View>
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
    <View style={styles.field}>
      <ThemedText variant="bodySm" color={theme.colors.textPrimary} style={styles.label}>
        {label}
      </ThemedText>
      {children}
      {error ? (
        <ThemedText variant="caption" color={theme.colors.error}>
          {error}
        </ThemedText>
      ) : null}
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
  field: { gap: 8 },
  label: { fontWeight: '700' },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: sawaaRadius.lg,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  saveBtn: {
    marginTop: 8,
    minHeight: 56,
    borderRadius: sawaaRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
