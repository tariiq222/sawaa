import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSawaaRoles, sawaaSpacing, withAlpha } from '@/theme/sawaa/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Bottom action area for tab-bar-less screens: the primary button (and an
 * optional secondary one) over a fade, so scrolled content never collides with
 * it. Give the screen's ScrollView `paddingBottom` of roughly 160.
 */
export function FloatingCta({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const background = getSawaaRoles(scheme).background;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(background, 0), withAlpha(background, 0xf0 / 255)]}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingBottom: insets.bottom + sawaaSpacing.lg }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 0, end: 0, bottom: 0 },
  content: { paddingTop: 48, paddingHorizontal: sawaaSpacing.lg, gap: 10 },
});
