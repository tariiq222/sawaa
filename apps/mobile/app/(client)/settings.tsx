import { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Bell,
  Check,
  Info,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { useTheme } from '@/theme/useTheme';
import { UnverifiedEmailBanner } from '@/components/features/auth/UnverifiedEmailBanner';
import { SettingsProfileSection } from './settings-profile-section';
import { clientProfileService } from '@/services/client/profile';
import { registerForPushAsync, unregisterPushAsync } from '@/services/push';

const LANGUAGE_KEY = '@sawaa/language';
const PUSH_KEY = '@sawaa/push-enabled';
const DARK_KEY = '@sawaa/dark-mode';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL, language } = useTheme();

  const [pushEnabled, setPushEnabled] = useState(false);
  const [darkEnabled, setDarkEnabled] = useState(false);
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    '1';

  useEffect(() => {
    AsyncStorage.getItem(PUSH_KEY).then((val) => {
      if (val !== null) setPushEnabled(val === 'true');
    });
    AsyncStorage.getItem(DARK_KEY).then((val) => {
      if (val !== null) setDarkEnabled(val === 'true');
    });
  }, []);

  const handleLanguageSelect = useCallback(
    async (lang: 'ar' | 'en') => {
      if (lang === language) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const handleTogglePush = useCallback(
    async (val: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPushEnabled(val);
      await AsyncStorage.setItem(PUSH_KEY, String(val));
      try {
        await clientProfileService.updateProfile({ pushEnabled: val });
      } catch (err) {
        console.warn('[Settings] Failed to sync push pref to server:', err);
      }
      if (val) {
        await registerForPushAsync();
      } else {
        await unregisterPushAsync();
      }
    },
    [],
  );

  const handleToggleDark = useCallback(
    async (val: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setDarkEnabled(val);
      await AsyncStorage.setItem(DARK_KEY, String(val));
    },
    [],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.backBtn}
          >
            <BackIcon size={24} strokeWidth={1.5} color={theme.colors.textPrimary} />
          </Pressable>
          <ThemedText variant="subheading">{t('settings.title')}</ThemedText>
          <View style={styles.backBtn} />
        </View>

        {/* Profile Section (server-backed) */}
        <UnverifiedEmailBanner />
        <SettingsProfileSection />

        {/* Language Section (local-only) */}
        <ThemedCard padding={20} style={{ marginBottom: 16 }}>
          <SectionHeader icon={Globe} label={t('settings.language')} />

          <LanguageOption
            label={t('settings.arabic')}
            selected={language === 'ar'}
            onPress={() => handleLanguageSelect('ar')}
          />
          <LanguageOption
            label={t('settings.english')}
            selected={language === 'en'}
            onPress={() => handleLanguageSelect('en')}
          />
        </ThemedCard>

        {/* Notifications + Appearance (local-only) */}
        <ThemedCard padding={20} style={{ marginBottom: 16 }}>
          <SectionHeader icon={Bell} label={t('settings.pushNotifications')} />
          <ThemedText
            variant="bodySm"
            color={theme.colors.textSecondary}
            style={{ marginBottom: 12 }}
          >
            {t('settings.pushNotificationsDesc')}
          </ThemedText>
          <View style={styles.switchRow}>
            <ThemedText variant="body">{t('settings.pushNotifications')}</ThemedText>
            <Switch
              value={pushEnabled}
              onValueChange={handleTogglePush}
              trackColor={{ false: '#E2E8F0', true: '#1D4ED880' }}
              thumbColor={pushEnabled ? '#1D4ED8' : '#CBD5E1'}
            />
          </View>
          <View style={[styles.switchRow, { marginTop: 12 }]}>
            <ThemedText variant="body">{t('settings.darkMode')}</ThemedText>
            <Switch
              value={darkEnabled}
              onValueChange={handleToggleDark}
              trackColor={{ false: '#E2E8F0', true: '#1D4ED880' }}
              thumbColor={darkEnabled ? '#1D4ED8' : '#CBD5E1'}
            />
          </View>
        </ThemedCard>

        {/* About Section */}
        <ThemedCard padding={20}>
          <SectionHeader icon={Info} label={t('settings.about')} />

          <ThemedText variant="heading" style={{ marginBottom: 8 }}>
            سواء
          </ThemedText>

          <AboutRow label={t('settings.version')} value={version} />
          <AboutRow label={t('settings.buildNumber')} value={buildNumber} />
        </ThemedCard>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: '#1D4ED814' }]}>
        <Icon size={20} strokeWidth={1.5} color="#1D4ED8" />
      </View>
      <ThemedText variant="subheading">{label}</ThemedText>
    </View>
  );
}

function LanguageOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.langRow,
        {
          backgroundColor: selected ? '#1D4ED808' : 'transparent',
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <ThemedText variant="body">{label}</ThemedText>
      {selected && <Check size={20} strokeWidth={2} color="#1D4ED8" />}
    </Pressable>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.aboutRow}>
      <ThemedText variant="bodySm" color={theme.colors.textSecondary}>
        {label}
      </ThemedText>
      <ThemedText variant="body">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
});
