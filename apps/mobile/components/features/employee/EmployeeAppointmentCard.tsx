import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Glass } from '@/theme/components/Glass';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { StatusPill } from '@/components/ui/StatusPill';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { getStatusLabel } from '@/lib/status-helpers';
import { getAppointmentDurationMins, getBookingDelivery, getServiceName } from '@/lib/employee-schedule';
import type { Booking } from '@/types/models';

interface EmployeeAppointmentCardProps {
  booking: Booking;
  onPress: () => void;
  /** Prepended to the accessibility label (the calendar uses the selected day). */
  labelPrefix?: string;
}

/**
 * Appointment row shared by the staff Today and Calendar tabs: time and duration
 * on the start edge, client and "service · delivery" in the middle, status pill
 * on the end edge. Only fields the booking really carries are shown.
 */
export function EmployeeAppointmentCard({ booking, onPress, labelPrefix }: EmployeeAppointmentCardProps) {
  const colors = useSawaaColors();
  const { t } = useTranslation();
  const dir = useDir();
  const clientName = booking.client
    ? `${booking.client.firstName} ${booking.client.lastName}`
    : t('doctor.clientRecord');
  const duration = getAppointmentDurationMins(booking);
  const delivery = t(getBookingDelivery(booking) === 'online' ? 'doctor.deliveryOnline' : 'doctor.deliveryInPerson');
  const subtitle = [getServiceName(booking, dir.isRTL), delivery].filter(Boolean).join(' · ');
  const statusLabel = t(getStatusLabel(booking.status));
  const textStyle = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;

  return (
    <Glass variant="base" radius={sawaaRadius.lg} padding={sawaaSpacing.md}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${labelPrefix ? `${labelPrefix} ` : ''}${clientName} ${booking.startTime} ${statusLabel}`}
        style={({ pressed }) => [styles.row, { flexDirection: dir.row, opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={[styles.timeCol, { borderColor: colors.ink[400] }, dir.isRTL ? styles.dividerStart : styles.dividerEnd]}>
          <Text style={[styles.time, { writingDirection: 'ltr', color: colors.teal[700], fontFamily: getFontName(dir.locale, '700') }]}>
            {booking.startTime}
          </Text>
          {duration !== null ? (
            <Text style={[styles.duration, { color: colors.ink[500], fontFamily: getFontName(dir.locale, '400') }]}>
              {t('doctor.durationMinutes', { count: duration })}
            </Text>
          ) : null}
        </View>
        <View style={styles.mid}>
          <Text style={[styles.name, textStyle, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700') }]}>
            {clientName}
          </Text>
          <Text style={[styles.sub, textStyle, { color: colors.ink[500], fontFamily: getFontName(dir.locale, '400') }]}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.status}><StatusPill status={booking.status} label={statusLabel} /></View>
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { flexWrap: 'wrap', alignItems: 'center', gap: sawaaSpacing.md, minHeight: 56 },
  timeCol: { minWidth: 64, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 2 },
  // The divider sits on the side of the time column that faces the client name.
  dividerStart: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: sawaaSpacing.md },
  dividerEnd: { borderRightWidth: StyleSheet.hairlineWidth, paddingRight: sawaaSpacing.md },
  time: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  duration: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight },
  status: { minWidth: 0, flexShrink: 1, maxWidth: '100%' },
  mid: { flexGrow: 1, flexBasis: 120, minWidth: 0, flexShrink: 1, gap: 2 },
  name: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  sub: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
});
