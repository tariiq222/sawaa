import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AquaBackground } from '@/theme/sawaa';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { sawaaRadius, sawaaSpacing, withAlpha } from '@/theme/sawaa';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { goBackOrHome } from '@/lib/navigation';
import { useDir } from '@/hooks/useDir';

/**
 * Shared chrome for every client settings page: surface background, safe-area
 * scroll and a labelled back control. Each settings route passes its own title so
 * the page itself states which purpose it serves.
 */
export function SettingsScaffold({
  title,
  children,
  keyboardSafe = false,
}: {
  title: string;
  children: React.ReactNode;
  keyboardSafe?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroll = (
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <ScreenHeader title={title} onBack={() => goBackOrHome(router, '/(client)/(tabs)/account')} />
        </View>
        {children}
      </ScrollView>
  );
  return <AquaBackground>{keyboardSafe ? <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>{scroll}</KeyboardAvoidingView> : scroll}</AquaBackground>;
}

export function SettingsSectionHeader({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  const { theme } = useTheme();
  const dir = useDir();
  return (
    <View style={[styles.sectionHeader, { flexDirection: dir.row }]}>
      <View style={[styles.sectionIcon, { backgroundColor: withAlpha(theme.colors.primary, 0.08) }]}>
        <Icon size={20} strokeWidth={1.5} color={theme.colors.primary} />
      </View>
      <ThemedText variant="subheading">{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: sawaaSpacing.lg },
  header: { marginBottom: sawaaSpacing.xl },
  sectionHeader: {
    alignItems: 'center',
    gap: sawaaSpacing.sm,
    marginBottom: sawaaSpacing.lg,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: sawaaRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
