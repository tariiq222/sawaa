import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa/tokens';

const statusColors = (colors: ReturnType<typeof useTheme>['theme']['colors']): Record<string, string> => ({
  pending: colors.status.pending,
  confirmed: colors.status.confirmed,
  completed: colors.status.completed,
  cancelled: colors.status.cancelled,
  cancel_requested: colors.status.pendingCancellation,
  available: colors.secondary[500],
  paid: colors.payment.paid,
  refunded: colors.payment.refunded,
  failed: colors.payment.failed,
});

interface StatusPillProps {
  status: string;
  label: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  const { theme } = useTheme();
  const palette = statusColors(theme.colors);
  const color = palette[status] ?? palette.pending;

  return (
    <View
      style={[styles.pill, {
        backgroundColor: withAlpha(color, 0.14),
        borderColor: withAlpha(color, 0.3),
      }]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: sawaaRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: sawaaSpacing.md,
    paddingVertical: sawaaSpacing.xs,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    fontWeight: '600',
  },
});
