import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaType, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export type PillTone = 'brand' | 'amber' | 'muted';

interface PillProps {
  label: string;
  tone?: PillTone;
}

/** Small tag (delivery type, availability, count). For booking/payment status use StatusPill. */
export function Pill({ label, tone = 'brand' }: PillProps) {
  const colors = useSawaaColors();
  const dir = useDir();
  const palette: Record<PillTone, { bg: string; fg: string }> = {
    brand: { bg: withAlpha(colors.teal[500], 0.14), fg: colors.teal[700] },
    amber: { bg: withAlpha(colors.accent.amber, 0.28), fg: colors.ink[900] },
    muted: { bg: withAlpha(colors.ink[500], 0.14), fg: colors.ink[700] },
  };
  return (
    <View style={[styles.pill, { backgroundColor: palette[tone].bg }]}>
      <Text style={[styles.label, { color: palette[tone].fg, fontFamily: getFontName(dir.locale, '600') }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { minHeight: 26, paddingHorizontal: 10, borderRadius: sawaaRadius.pill, justifyContent: 'center', alignSelf: 'flex-start' },
  label: { fontSize: sawaaType.caption.fontSize },
});
