import { useCallback } from 'react';
import { ActivityIndicator, View, Alert, Linking, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Bell, ChevronLeft, ChevronRight, Lock, Moon } from 'lucide-react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/theme/components/ThemedText';
import { sawaaRadius, sawaaSpacing } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useTheme } from '@/theme/useTheme';
import { SettingsScaffold } from '@/components/features/settings/SettingsScaffold';
import { GlassSegmented } from '@/components/ui/GlassSegmented';
import { GlassSwitch } from '@/components/ui/GlassSwitch';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useUpdateClientProfile } from '@/hooks/queries/useClientProfile';
import { LANGUAGE_KEY } from '@/hooks/language-preference';
import { useDir } from '@/hooks/useDir';
import { PRIVACY_POLICY_URL } from '@/constants/config';
import { AppButton } from '@/components/ui/AppButton';
import { AboutSection } from '@/components/features/settings/AboutSection';
import { usePushPreference } from '@/hooks/queries/usePushPreference';

/** Purpose-built route: app-wide preferences — language, appearance, about. */
export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { theme, language, scheme, setThemeMode } = useTheme();
  const dir = useDir();
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;
  const { query: pushPreference, mutation: pushMutation } = usePushPreference();
  const { mutateAsync: updateProfile } = useUpdateClientProfile();
  const pushEnabled = pushPreference.data?.enabled === true && pushPreference.data?.permitted === true;

  const handleLanguageSelect = useCallback(
    async (lang: 'ar' | 'en') => {
      if (lang === language) return;
      await i18n.changeLanguage(lang);
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
      updateProfile({ preferredLocale: lang })
        .catch((err) => console.warn('[Settings] Failed to sync locale to server:', err));
      Alert.alert(t('settings.languageChangeRestart'), '', [
        { text: t('settings.restartLater'), style: 'cancel' },
        {
          text: t('settings.restartNow'),
          onPress: async () => {
            await Updates.reloadAsync();
          },
        },
      ]);
    },
    [language, i18n, t, updateProfile],
  );

  const handleTogglePush = useCallback(
    async (enabled: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        await pushMutation.mutateAsync(enabled);
      } catch {
        Alert.alert(t('settings.pushNotifications'), t('settings.pushUpdateError'));
      }
    },
    [pushMutation, t],
  );

  return (
    <SettingsScaffold title={t('settings.title')}>
      <View style={styles.section}>
        <SectionHeader title={t('settings.language')} />
        <GlassSegmented
          options={[
            { value: 'ar', label: t('settings.arabic') },
            { value: 'en', label: t('settings.english') },
          ]}
          value={language === 'en' ? 'en' : 'ar'}
          onChange={handleLanguageSelect}
          appearance="navigation"
        />
      </View>

      <Glass variant="strong" radius={sawaaRadius.lg} style={styles.group}>
        <View style={[styles.row, { flexDirection: dir.row }]}>
          <Moon size={22} color={theme.colors.primary} strokeWidth={1.75} />
          <ThemedText variant="body" style={styles.rowLabel}>{t('settings.darkMode')}</ThemedText>
          <GlassSwitch
            value={scheme === 'dark'}
            onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')}
            accessibilityLabel={t('settings.darkMode')}
          />
        </View>
        <View style={[styles.row, styles.divider, { flexDirection: dir.row, borderTopColor: theme.colors.border }]}>
          <Bell size={22} color={theme.colors.primary} strokeWidth={1.75} />
          <ThemedText variant="body" style={styles.rowLabel}>{t('settings.pushNotifications')}</ThemedText>
          <GlassSwitch
            value={pushEnabled}
            disabled={pushPreference.isPending || pushPreference.isError || pushMutation.isPending}
            onValueChange={handleTogglePush}
            accessibilityLabel={t('settings.pushNotifications')}
          />
        </View>
        {pushPreference.isPending ? <View accessibilityLiveRegion="polite" style={styles.preferenceStatus}>
          <ActivityIndicator color={theme.colors.primary} /><ThemedText>{t('common.loading')}</ThemedText>
        </View> : pushPreference.isError ? <View style={styles.preferenceStatus}>
          <ThemedText accessibilityRole="alert" color={theme.colors.error}>{t('settings.pushLoadError')}</ThemedText>
          <AppButton label={t('common.retry')} variant="ghost" size="sm" onPress={() => void pushPreference.refetch()} />
        </View> : pushPreference.data?.permitted === false ? <ThemedText accessibilityLiveRegion="polite" style={styles.preferenceStatus}>
          {t('settings.pushPermissionRequired')}
        </ThemedText> : null}
      </Glass>

      <Glass
        variant="strong"
        radius={sawaaRadius.lg}
        style={styles.group}
        onPress={() => { void Linking.openURL(PRIVACY_POLICY_URL); }}
        interactive
        accessibilityLabel={t('settings.privacyPolicy')}
      >
        <View style={[styles.row, { flexDirection: dir.row }]}>
          <Lock size={22} color={theme.colors.primary} strokeWidth={1.75} />
          <ThemedText variant="body" style={styles.rowLabel}>{t('settings.privacyPolicy')}</ThemedText>
          <Chevron size={18} color={theme.colors.textSecondary} strokeWidth={1.75} />
        </View>
      </Glass>

      <AboutSection />
    </SettingsScaffold>
  );
}
const styles = StyleSheet.create({
  section: { gap: sawaaSpacing.md, marginBottom: sawaaSpacing.xl },
  group: { padding: 0, marginBottom: sawaaSpacing.xl },
  row: { alignItems: 'center', gap: sawaaSpacing.md, paddingHorizontal: sawaaSpacing.lg, minHeight: 56 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  rowLabel: { flex: 1, minWidth: 0, flexShrink: 1 },
  preferenceStatus: { paddingHorizontal: sawaaSpacing.lg, paddingBottom: sawaaSpacing.md, gap: sawaaSpacing.sm },
});
