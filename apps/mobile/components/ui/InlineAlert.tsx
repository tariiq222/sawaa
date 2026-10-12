import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CircleAlert } from 'lucide-react-native';

import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { useDir } from '@/hooks/useDir';
import { sawaaRadius, sawaaSpacing, withAlpha } from '@/theme/sawaa/tokens';

/** Centered, tinted one-row box (icon + message) for a form error shown in place of a popup. */
export function InlineAlert({ message }: { message: string }) {
  const { theme } = useTheme();
  const dir = useDir();
  const tone = theme.colors.error;
  return (
    <View accessibilityRole="alert" style={[styles.box, { flexDirection: dir.row, backgroundColor: withAlpha(tone, 0.1), borderColor: withAlpha(tone, 0.35) }]}>
      <CircleAlert size={18} color={tone} />
      <ThemedText variant="bodySm" color={tone} style={styles.text}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.xs,
    borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: sawaaRadius.md,
    paddingVertical: sawaaSpacing.md, paddingHorizontal: sawaaSpacing.lg,
  },
  text: { flexShrink: 1, textAlign: 'center' },
});
