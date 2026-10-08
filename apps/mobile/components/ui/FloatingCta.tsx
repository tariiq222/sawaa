import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSawaaRoles, sawaaSpacing, withAlpha } from '@/theme/sawaa/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Bottom action area for tab-bar-less screens: the primary button (and an
 * optional secondary one) over a fade, so scrolled content never collides with
 * it. Reserve its measured height plus spacing in the screen's ScrollView.
 */
export function FloatingCta({ children, onHeightChange }: { children: React.ReactNode; onHeightChange?: (height: number) => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { scheme } = useTheme();
  const background = getSawaaRoles(scheme).background;
  return (
    <View testID="floating-cta" pointerEvents="box-none" style={[styles.wrap, { maxHeight: (height - insets.top) / 2 }]}
      onLayout={({ nativeEvent }) => {
        const height = nativeEvent.layout.height;
        if (Number.isFinite(height) && height > 0) onHeightChange?.(height);
      }}>
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(background, 0), withAlpha(background, 0xf0 / 255)]}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + sawaaSpacing.lg }]}>{children}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 0, end: 0, bottom: 0 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingTop: 48, paddingHorizontal: sawaaSpacing.lg, gap: 10 },
});
