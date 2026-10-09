import React, { useCallback } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bell, Languages, Moon } from 'lucide-react-native';

import { MenuGroup, type MenuEntry } from '@/components/ui/MenuGroup';
import { GlassSegmented } from '@/components/ui/GlassSegmented';
import { GlassSwitch } from '@/components/ui/GlassSwitch';
import { AppButton } from '@/components/ui/AppButton';
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { sawaaSpacing } from '@/theme/sawaa/tokens';
import { LANGUAGE_KEY } from '@/hooks/language-preference';
import { useUpdateClientProfile } from '@/hooks/queries/useClientProfile';
import { usePushPreference } from '@/hooks/queries/usePushPreference';

/**
 * Inline preferences shared by the client and employee account tabs: language,
 * appearance and (for clients) push notifications. There is no separate
 * settings page; each control changes in place.
 */
export function AccountPreferences({ role }: { role: 'client' | 'employee' }) {
  const { t, i18n } = useTranslation();
  const { theme, language, scheme, setThemeMode } = useTheme();
  const isClient = role === 'client';
  const { query: pushPreference, mutation: pushMutation } = usePushPreference();
  const { mutateAsync: updateProfile } = useUpdateClientProfile();
  const pushEnabled = pushPreference.data?.enabled === true && pushPreference.data?.permitted === true;

  const handleLanguageSelect = useCallback(async (lang: 'ar' | 'en') => {
    if (lang === language) return;
    await i18n.changeLanguage(lang);
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    if (isClient) {
      updateProfile({ preferredLocale: lang })
        .catch((err) => console.warn('[AccountPreferences] Failed to sync locale to server:', err));
    }
    Alert.alert(t('settings.languageChangeRestart'), '', [
      { text: t('settings.restartLater'), style: 'cancel' },
      { text: t('settings.restartNow'), onPress: async () => { await Updates.reloadAsync(); } },
    ]);
  }, [language, i18n, isClient, t, updateProfile]);

  const handleTogglePush = useCallback(async (enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await pushMutation.mutateAsync(enabled);
    } catch {
      Alert.alert(t('settings.pushNotifications'), t('settings.pushUpdateError'));
    }
  }, [pushMutation, t]);

  const entries: MenuEntry[] = [
    {
      key: 'dark-mode',
      icon: Moon,
      label: t('settings.darkMode'),
      trailing: <GlassSwitch value={scheme === 'dark'} onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')} accessibilityLabel={t('settings.darkMode')} />,
    },
  ];
  if (isClient) {
    entries.push({
      key: 'push',
      icon: Bell,
      label: t('settings.pushNotifications'),
      trailing: <GlassSwitch value={pushEnabled}
        disabled={pushPreference.isPending || pushPreference.isError || pushMutation.isPending}
        onValueChange={handleTogglePush} accessibilityLabel={t('settings.pushNotifications')} />,
    });
  }

  const pushStatus = !isClient ? null : pushPreference.isPending ? (
    <View accessibilityLiveRegion="polite" style={styles.status}>
      <ActivityIndicator color={theme.colors.primary} /><ThemedText>{t('common.loading')}</ThemedText>
    </View>
  ) : pushPreference.isError ? (
    <View style={styles.status}>
      <ThemedText accessibilityRole="alert" color={theme.colors.error}>{t('settings.pushLoadError')}</ThemedText>
      <AppButton label={t('common.retry')} variant="ghost" size="sm" onPress={() => void pushPreference.refetch()} />
    </View>
  ) : pushPreference.data?.permitted === false ? (
    <ThemedText accessibilityLiveRegion="polite" style={styles.status}>{t('settings.pushPermissionRequired')}</ThemedText>
  ) : null;

  return (
    <View style={styles.wrap}>
      <MenuGroup
        title={t('profile.preferences')}
        entries={[{ key: 'language', icon: Languages, label: t('settings.language') }]}
        footer={(
          <View style={styles.segment}>
            <GlassSegmented
              options={[{ value: 'ar', label: t('settings.arabic') }, { value: 'en', label: t('settings.english') }]}
              value={language === 'en' ? 'en' : 'ar'}
              onChange={handleLanguageSelect}
              size="sm"
            />
          </View>
        )}
      />
      <MenuGroup entries={entries} footer={pushStatus} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: sawaaSpacing.md },
  segment: { paddingHorizontal: sawaaSpacing.lg, paddingBottom: sawaaSpacing.md },
  status: { paddingHorizontal: sawaaSpacing.lg, paddingBottom: sawaaSpacing.md, gap: sawaaSpacing.sm },
});
