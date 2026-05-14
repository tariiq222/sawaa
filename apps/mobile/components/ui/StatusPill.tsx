import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '@deqah/shared/tokens';

const STATUS_COLOR: Record<string, string> = {
  pending: colors.status.pending,
  confirmed: colors.status.confirmed,
  completed: colors.status.completed,
  cancelled: colors.status.cancelled,
  cancel_requested: colors.status.pendingCancellation,
  available: colors.secondary[500],
  paid: colors.payment.paid,
  refunded: colors.payment.refunded,
  failed: colors.payment.failed,
};

const TINT_ALPHA = '1A';

interface StatusPillProps {
  status: string;
  label: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.pending;

  return (
    <View
      style={{
        backgroundColor: `${color}${TINT_ALPHA}`,
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
