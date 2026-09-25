import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AquaBackground } from '@/theme/sawaa';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/sawaa';

/**
 * Shared chrome for every client settings page: surface background, safe-area
 * scroll and a labelled back control. Each settings route passes its own title so
 * the page itself states which purpose it serves.
 */
export function SettingsScaffold({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme, isRTL } = useTheme();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.buttonBack')}
          >
            <BackIcon size={24} strokeWidth={1.5} color={theme.colors.textPrimary} />
          </Pressable>
          <ThemedText variant="subheading">{title}</ThemedText>
          <View style={styles.backBtn} />
        </View>
        {children}
      </ScrollView>
    </AquaBackground>
  );
}

export function SettingsSectionHeader({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: withAlpha(theme.colors.primary, 0.08) }]}>
        <Icon size={20} strokeWidth={1.5} color={theme.colors.primary} />
      </View>
      <ThemedText variant="subheading">{label}</ThemedText>
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
});
