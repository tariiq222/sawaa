import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ExploreDirectory } from '@/components/features/explore/ExploreDirectory';
import { GuestDock } from '@/components/features/home/GuestDock';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { AquaBackground } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export default function PublicExploreScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();

  return (
    <AquaBackground>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120 }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}>
          {t('tabs.explore')}
        </Text>
        <ExploreDirectory />
      </ScrollView>
      <GuestDock active="explore" />
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 20 },
  title: { fontSize: 26, lineHeight: 34 },
});
