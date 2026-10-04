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
  const bgColor = palette[status] ?? palette.pending;
  // In light mode, use darker foreground shades for >=4.5:1 contrast on the
  // composited pill background (status color at 14% alpha over surface).
  // Dark mode accents are already bright enough — fall back to the bg color.
  const fgMap = theme.colors.statusForeground as Record<string, string> | null;
  const textColor = fgMap?.[status === 'cancel_requested' ? 'pendingCancellation' : status] ?? bgColor;

  return (
    <View
      style={[styles.pill, {
        backgroundColor: withAlpha(bgColor, 0.14),
        borderColor: withAlpha(bgColor, 0.3),
      }]}
    >
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
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
