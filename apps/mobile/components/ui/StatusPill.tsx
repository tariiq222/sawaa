import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/sawaa/tokens';

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
      style={{
        backgroundColor: withAlpha(color, 0.1),
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
