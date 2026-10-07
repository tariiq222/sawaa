import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Building2, Video } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/theme/components/ThemedText';
import { StatusPill } from '@/components/ui/StatusPill';
import { useTheme } from '@/theme/useTheme';
import { formatHalalas } from '@/lib/money';
import type { Booking } from '@/types/models';
import { withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

const TYPE_ICON = {
  individual: Building2,
  in_person: Building2,
  online: Video,
  walk_in: Building2,
  group: Building2,
};

const typeColors = (colors: ReturnType<typeof useSawaaColors>) => ({
  individual: colors.teal[700],
  in_person: colors.teal[700],
  online: colors.accent.violet,
  walk_in: colors.teal[600],
  group: colors.accent.violet,
});

interface AppointmentCardProps {
  booking: Booking;
  onPress: (id: string) => void;
}

export function AppointmentCard({ booking, onPress }: AppointmentCardProps) {
  const { t } = useTranslation();
  const { theme, isRTL } = useTheme();
  const Icon = TYPE_ICON[booking.type];
  const palette = useSawaaColors();
  const color = typeColors(palette)[booking.type];

  const statusLabels: Record<string, string> = {
    pending: t('appointments.pending'),
    confirmed: t('appointments.confirmed'),
    deposit_paid: t('appointments.depositPaid'),
    completed: t('appointments.completed'),
    cancelled: t('appointments.cancelledStatus'),
    cancel_requested: t('appointments.pendingCancellation'),
  };

  const practName = `${booking.employee.user.firstName} ${booking.employee.user.lastName}`;
  const date = new Date(booking.date);
  const formattedDate = date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Pressable
      onPress={() => onPress(booking.id)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.white,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.row}>
        <View
          style={[styles.iconCircle, { backgroundColor: withAlpha(color, 0.08) }]}
        >
          <Icon size={18} strokeWidth={1.5} color={color} />
        </View>
        <View style={styles.info}>
          <ThemedText variant="subheading" numberOfLines={1}>
            {practName}
          </ThemedText>
          <ThemedText variant="bodySm" numberOfLines={1}>
            {isRTL ? booking.employee.specialtyAr : booking.employee.specialty}
          </ThemedText>
        </View>
        <StatusPill
          status={booking.status}
          label={statusLabels[booking.status] ?? booking.status}
        />
      </View>
      <View style={[styles.footer, { borderTopColor: theme.colors.surfaceLow }]}>
        <ThemedText variant="caption" color={theme.colors.textSecondary}>
          {formattedDate} • {booking.startTime}
        </ThemedText>
        <ThemedText variant="caption" color={palette.teal[700]} style={{ fontWeight: '600' }}>
          {formatHalalas(booking.totalAmount, { locale: isRTL ? 'ar-SA' : 'en-US' })} {t('home.sar')}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
  },
});
