import { useCallback } from 'react';
import { View, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Globe, Info, Moon } from 'lucide-react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { ThemedText } from '@/theme/components/ThemedText';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useTheme } from '@/theme/useTheme';
import { SettingsScaffold, SettingsSectionHeader } from '@/components/features/settings/SettingsScaffold';
import { GlassSegmented } from '@/components/ui/GlassSegmented';
import { GlassSwitch } from '@/components/ui/GlassSwitch';
import { DeleteAccountButton } from '@/components/features/settings/DeleteAccountButton';
import { clientProfileService } from '@/services/client/profile';
import { LANGUAGE_KEY } from '@/hooks/language-preference';
import { useDir } from '@/hooks/useDir';

/** Purpose-built route: app-wide preferences — language, appearance, about. */
export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { language, scheme, setThemeMode } = useTheme();
  const dir = useDir();

  const version = Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber =
    Constants.nativeBuildVersion ??
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    '1';

  const handleLanguageSelect = useCallback(
    async (lang: 'ar' | 'en') => {
      if (lang === language) return;
      await i18n.changeLanguage(lang);
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
      clientProfileService
        .updateProfile({ preferredLocale: lang })
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
    [language, i18n, t],
  );

  return (
    <SettingsScaffold title={t('settings.title')}>
      {/* Language Section (local-only) */}
      <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
        <SettingsSectionHeader icon={Globe} label={t('settings.language')} />

        <GlassSegmented
          options={[
            { value: 'ar', label: t('settings.arabic') },
            { value: 'en', label: t('settings.english') },
          ]}
          value={language === 'en' ? 'en' : 'ar'}
          onChange={handleLanguageSelect}
          appearance="navigation"
        />
      </Glass>

      {/* Appearance */}
      <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
        <SettingsSectionHeader icon={Moon} label={t('settings.appearance')} />
        <View style={[styles.switchRow, { flexDirection: dir.row }]}>
          <ThemedText variant="body">{t('settings.darkMode')}</ThemedText>
          <GlassSwitch
            value={scheme === 'dark'}
            onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')}
            accessibilityLabel={t('settings.darkMode')}
          />
        </View>
      </Glass>

      <DeleteAccountButton />

      {/* About Section */}
      <Glass variant="strong" radius={sawaaRadius.xl} style={styles.cardLast}>
        <SettingsSectionHeader icon={Info} label={t('settings.about')} />

        <ThemedText variant="heading" style={styles.brand}>
          سواء
        </ThemedText>

        <AboutRow label={t('settings.version')} value={version} />
        <AboutRow label={t('settings.buildNumber')} value={buildNumber} />
      </Glass>
    </SettingsScaffold>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const dir = useDir();
  return (
    <View style={[styles.aboutRow, { flexDirection: dir.row }]}>
      <ThemedText variant="bodySm" color={theme.colors.textSecondary}>
        {label}
      </ThemedText>
      <ThemedText variant="body">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: sawaaSpacing.xl, marginBottom: sawaaSpacing.lg },
  cardLast: { padding: sawaaSpacing.xl },
  brand: { marginBottom: sawaaSpacing.sm, fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  switchRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aboutRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sawaaSpacing.sm,
  },
});
