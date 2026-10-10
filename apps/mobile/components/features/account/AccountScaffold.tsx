import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AquaBackground } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

/** Tab-root chrome shared by the client and employee account tabs. */
export function AccountScaffold({ title, children, refreshing, onRefresh }: {
  title: string;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const colors = useSawaaColors();
  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.xl, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.teal[600]} /> : undefined}
      >
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
          {title}
        </Text>
        {children}
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.xl },
  title: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
});
