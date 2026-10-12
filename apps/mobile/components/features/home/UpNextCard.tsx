import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { formatDayMonth, formatDayWeekday, formatTimeOfDay } from '@/lib/session-format';
import { isPortalBookingLive, portalBookingEndInstant, portalBookingInstant } from '@/lib/portal-booking-time';
import { Glass } from '@/theme/components/Glass';
import { sawaaRadius, sawaaSpacing, sawaaType, getSawaaRoles, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/ThemeProvider';
import { JoinVideoCallButton } from '@/components/features/JoinVideoCallButton';
import type { DirState } from '@/hooks/useDir';
import type { PortalBookingRow } from '@/services/client/portal';

interface UpNextCardProps {
  loading: boolean;
  booking: PortalBookingRow | null;
  dir: DirState;
  f600: string;
  f700: string;
  /** Clock used to decide whether the session is live; defaults to the current time. */
  now?: number;
}

/** "Next appointment" hero: date box, time, details and status; switches to a live state with a join button while the session runs. */
export function UpNextCard({ loading, booking, dir, f600, f700, now }: UpNextCardProps) {
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const roles = getSawaaRoles(scheme);
  const action = roles.action;
  const styles = React.useMemo(() => createStyles(colors, action), [colors, action]);
  const router = useRouter();
  const { t } = useTranslation();
  const ArrowIcon = dir.isRTL ? ChevronLeft : ChevronRight;
  const iso = booking ? portalBookingInstant(booking) : null;

  if (loading) {
    return (
      <Glass variant="strong" radius={sawaaRadius.xl} style={[styles.card, styles.loading]}>
        <ActivityIndicator color={colors.teal[600]} />
      </Glass>
    );
  }

  if (!booking || !iso) {
    return (
      <Glass variant="strong" radius={sawaaRadius.xl} style={[styles.card, styles.empty]}>
        <Text style={[styles.emptyText, { fontFamily: f600, textAlign: dir.textAlign }]}>{t('home.noUpcoming')}</Text>
        <Pressable onPress={() => router.push('/(client)/clinics')} accessibilityRole="button" style={styles.emptyCta}>
          <Text style={[styles.emptyCtaText, { fontFamily: f700 }]}>{t('home.bookNow')}</Text>
        </Pressable>
      </Glass>
    );
  }

  const live = isPortalBookingLive(booking, now ?? Date.now());
  const endIso = portalBookingEndInstant(booking);
  const { weekday } = formatDayWeekday(iso, dir.isRTL)!;
  const { day, month } = formatDayMonth(iso, dir.isRTL)!;
  const time = formatTimeOfDay(iso, dir.isRTL)!;
  const endTime = endIso ? formatTimeOfDay(endIso, dir.isRTL) : null;
  const timeRange = endTime ? `${time} – ${endTime}` : time;
  const employeeName = booking.employee
    ? `${booking.employee.user.firstName} ${booking.employee.user.lastName}`.trim()
    : '';
  const serviceName = booking.service ? (dir.isRTL ? booking.service.nameAr : booking.service.nameEn || booking.service.nameAr) : '';
  const deliveryType = booking.deliveryType ?? booking.type;
  const isOnline = deliveryType === 'online';
  const delivery = isOnline ? t('home.online') : deliveryType === 'in_person' ? t('home.inPerson') : '';
  const detail = [serviceName, employeeName ? t('home.withTherapist', { name: employeeName }) : '', delivery].filter(Boolean).join(' · ');
  const status = booking.status?.toLowerCase();
  const statusLabel = status === 'pending' ? t('appointments.pending') : status === 'confirmed' || status === 'deposit_paid' ? t('appointments.confirmed') : '';
  const pillLabel = live ? t('home.liveNow') : statusLabel;
  const durationMins = booking.service?.duration
    ?? (endIso ? Math.max(1, Math.round((new Date(endIso).getTime() - new Date(iso).getTime()) / 60_000)) : 60);
  const mainLine = live ? timeRange : `${weekday} · ${timeRange}`;

  return (
    <LinearGradient
      colors={action.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, styles.hero]}
    >
      <Pressable
        onPress={() => router.push(`/(client)/appointment/${booking.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${live ? t('home.liveLabel') : t('home.upcomingAppointment')}: ${weekday} ${day} ${month}, ${timeRange}. ${detail}`}
        accessibilityHint={t('home.openAppointment')}
        style={styles.content}
      >
        <View style={[styles.labelRow, { flexDirection: dir.row }]}>
          <Text style={[styles.label, { fontFamily: f600, textAlign: dir.textAlign }]}>{live ? t('home.liveLabel') : t('home.upcomingAppointment')}</Text>
          {pillLabel ? (
            <View style={styles.pill}>
              <Text style={[styles.pillText, { fontFamily: f600 }]}>{pillLabel}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.row, { flexDirection: dir.row }]}>
          {live ? null : (
            <View style={styles.dateBox}>
              <Text style={[styles.dateDay, { fontFamily: f700 }]}>{day}</Text>
              <Text style={[styles.dateMonth, { fontFamily: f600 }]}>{month}</Text>
            </View>
          )}
          <View style={styles.mid}>
            <Text style={[styles.time, { fontFamily: f700, textAlign: dir.textAlign }]}>{mainLine}</Text>
            {detail ? (
              <Text numberOfLines={2} style={[styles.detail, { fontFamily: f600, textAlign: dir.textAlign }]}>{detail}</Text>
            ) : null}
          </View>
          <View style={styles.go}>
            <ArrowIcon size={20} color={colors.teal[700]} strokeWidth={2} />
          </View>
        </View>
      </Pressable>
      {live && isOnline ? (
        <JoinVideoCallButton
          url={booking.zoomJoinUrl}
          scheduledAt={iso}
          durationMins={durationMins}
          status={booking.zoomMeetingStatus ?? null}
          isRTL={dir.isRTL}
          variant="join"
          fullWidth
        />
      ) : null}
    </LinearGradient>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>, action: ReturnType<typeof getSawaaRoles>['action']) => StyleSheet.create({
  card: { padding: 16, borderRadius: sawaaRadius.xl, gap: 10 },
  hero: { overflow: 'hidden' },
  content: { gap: 10 },
  labelRow: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: sawaaRadius.pill, backgroundColor: withAlpha(action.foreground, 0.2) },
  pillText: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight, color: action.foreground },
  loading: { alignItems: 'center', justifyContent: 'center', minHeight: 96 },
  empty: { alignItems: 'center' },
  emptyText: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[700] },
  emptyCta: { minHeight: 44, justifyContent: 'center' },
  emptyCtaText: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.teal[700] },
  label: { flex: 1, fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight, color: withAlpha(action.foreground, 0.85) },
  row: { alignItems: 'center', gap: 12 },
  dateBox: {
    width: 56,
    minHeight: 56,
    paddingVertical: sawaaSpacing.sm,
    borderRadius: sawaaRadius.md,
    backgroundColor: colors.teal[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight, color: colors.teal[700] },
  dateMonth: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight, color: colors.teal[700] },
  mid: { flex: 1, gap: 2 },
  time: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight, color: action.foreground },
  detail: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: withAlpha(action.foreground, 0.9) },
  go: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.teal[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
