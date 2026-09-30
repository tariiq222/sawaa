import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { JoinVideoCallButton } from '@/components/features/JoinVideoCallButton';
import { DateBox } from '@/components/ui/DateBox';
import { StatusPill } from '@/components/ui/StatusPill';
import { useDir } from '@/hooks/useDir';
import { formatDayMonth, formatTimeOfDay } from '@/lib/session-format';
import { STATUS_LABEL_MAP } from '@/lib/status-helpers';
import type { ClientBookingRow } from '@/services/client/bookings';
import { hasZoomMeetingAccess } from '@/types/booking-enums';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface AppointmentRowCardProps {
  booking: ClientBookingRow;
  onPress: () => void;
  /** Offer the join button (upcoming appointments only). Still hidden while video calls are off. */
  showJoin: boolean;
}

/** Appointment card of the appointments tab: date box, time, therapist, status and (when allowed) join. */
export function AppointmentRowCard({ booking: b, onPress, showJoin }: AppointmentRowCardProps) {
  const colors = useSawaaColors();
  const dir = useDir();
  const { t } = useTranslation();

  const therapistName = (dir.isRTL
    ? b.employee?.nameAr ?? b.employee?.nameEn
    : b.employee?.nameEn ?? b.employee?.nameAr) ?? '—';
  const time = formatTimeOfDay(b.scheduledAt, dir.isRTL) ?? t('appointments.toBeScheduled');
  const statusKey = STATUS_LABEL_MAP[b.status];
  const statusLabel = statusKey ? t(statusKey) : '—';
  const dayMonth = formatDayMonth(b.scheduledAt, dir.isRTL);
  const dateText = dayMonth ? `${dayMonth.day} ${dayMonth.month}` : t('appointments.toBeScheduled');

  return (
    <Glass variant="strong" radius={sawaaRadius.lg} style={styles.card}>
      <Pressable
        onPress={onPress}
        style={[styles.top, { flexDirection: dir.row }]}
        accessibilityRole="button"
        accessibilityLabel={t('appointments.cardA11y', { name: therapistName, date: dateText, time, status: statusLabel })}
        accessibilityHint={t('a11y.cardOpenAppointment')}
        testID={`appt-${b.id}`}
      >
        <DateBox iso={b.scheduledAt} fallback={t('appointments.toBeScheduled')} />
        <View style={styles.mid}>
          <Text numberOfLines={1} style={[styles.time, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}>
            {time}
          </Text>
          <Text numberOfLines={1} style={[styles.name, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>
            {t('appointments.with', { name: therapistName })}
          </Text>
        </View>
        <StatusPill status={b.status} label={statusLabel} />
      </Pressable>
      {showJoin && hasZoomMeetingAccess(b) ? (
        <JoinVideoCallButton
          url={b.zoomJoinUrl ?? b.zoomLink ?? null}
          scheduledAt={b.scheduledAt}
          durationMins={b.durationMins}
          status={b.zoomMeetingStatus}
          isRTL={dir.isRTL}
          variant="join"
          fullWidth
        />
      ) : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  top: { alignItems: 'center', gap: 12 },
  mid: { flex: 1, minWidth: 0, gap: 2 },
  time: { fontSize: sawaaType.subheading.fontSize - 2, lineHeight: sawaaType.subheading.lineHeight },
  name: { fontSize: 14, lineHeight: 20 },
});
