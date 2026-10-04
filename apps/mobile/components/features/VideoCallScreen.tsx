import { View, ScrollView, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Briefcase, Video } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { useTheme } from '@/theme/useTheme';
import { useDir } from '@/hooks/useDir';
import { useBooking, useEmployeeBooking } from '@/hooks/queries';
import { JoinVideoCallButton } from '@/components/features/JoinVideoCallButton';
import type { ClientBookingRow } from '@/services/client/bookings';
import type { Booking } from '@/types/models';
import { hasZoomMeetingAccess } from '@/types/booking-enums';
import { AquaBackground } from '@/theme/sawaa';
import { getSawaaRoles } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getFontName } from '@/theme/fonts';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { InfoRows } from '@/components/ui/InfoRows';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { formatWeekdayDateTime } from '@/lib/session-format';
import { getVideoJoinState } from '@/components/features/video-join-state';

interface VideoCallScreenProps {
  role: 'client' | 'employee';
}

interface BookingView {
  scheduledAt: string;
  durationMins: number;
  url: string | null;
  meetingStatus: 'PENDING' | 'CREATED' | 'FAILED' | 'CANCELLED' | null;
  serviceName: string;
  counterpartyName: string;
  canShowZoom: boolean;
}

function pickLocale(ar: string | null | undefined, en: string | null | undefined, isRTL: boolean): string {
  if (isRTL) return ar ?? en ?? '';
  return en ?? ar ?? '';
}

function adaptClient(row: ClientBookingRow, isRTL: boolean): BookingView {
  return {
    scheduledAt: row.scheduledAt,
    durationMins: row.durationMins,
    url: row.zoomJoinUrl,
    meetingStatus: row.zoomMeetingStatus,
    serviceName: pickLocale(row.service?.nameAr ?? null, row.service?.nameEn ?? null, isRTL),
    counterpartyName: pickLocale(row.employee?.nameAr ?? null, row.employee?.nameEn ?? null, isRTL),
    canShowZoom: hasZoomMeetingAccess(row),
  };
}

function adaptEmployee(b: Booking, isRTL: boolean): BookingView {
  // The employee mapper doesn't emit `scheduledAt`; reconstruct it from the
  // `date` + `startTime` pair, which the backend formats in the business time
  // zone (Asia/Riyadh, +03:00, no DST) - not UTC.
  const scheduledAt =
    b.scheduledAt ??
    new Date(`${b.date}T${b.startTime}:00+03:00`).toISOString();
  // duration: prefer durationMins, fall back to service.duration if present.
  const durationMins = b.durationMins ?? b.service?.duration ?? 0;
  const clientName = b.client
    ? `${b.client.firstName} ${b.client.lastName}`.trim()
    : '';
  return {
    scheduledAt,
    durationMins,
    // Employee = host; uses zoomStartUrl when available, falls back to zoomJoinUrl.
    url: b.zoomStartUrl ?? b.zoomJoinUrl ?? null,
    meetingStatus: b.zoomMeetingStatus ?? null,
    serviceName: pickLocale(b.service?.nameAr ?? null, b.service?.nameEn ?? null, isRTL),
    counterpartyName: clientName,
    canShowZoom: hasZoomMeetingAccess(b),
  };
}

export function VideoCallScreen({ role }: VideoCallScreenProps) {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, scheme } = useTheme();
  const colors = useSawaaColors();
  const dir = useDir();

  const clientBookingQuery = useBooking(role === 'client' ? bookingId : undefined);
  const employeeBookingQuery = useEmployeeBooking(role === 'employee' ? bookingId : undefined);
  const loading = role === 'client' ? clientBookingQuery.isLoading : employeeBookingQuery.isLoading;
  const view = role === 'client'
    ? clientBookingQuery.data ? adaptClient(clientBookingQuery.data, dir.isRTL) : null
    : employeeBookingQuery.data ? adaptEmployee(employeeBookingQuery.data, dir.isRTL) : null;
  const queryError = role === 'client' ? clientBookingQuery.isError : employeeBookingQuery.isError;
  const notFound = !bookingId || (!loading && (queryError || !view));

  const formattedTime = view ? formatWeekdayDateTime(view.scheduledAt, dir.isRTL) ?? '' : '';
  const joinState = view
    ? getVideoJoinState({
        scheduledAt: view.scheduledAt,
        durationMins: view.durationMins,
        linkReady: view.meetingStatus === 'CREATED' && Boolean(view.url),
      })
    : 'waiting';
  const isOpen = joinState === 'open';
  const title = joinState === 'open'
    ? t('videoCall.readyTitle')
    : joinState === 'ended' ? t('videoCall.sessionEnded') : t('videoCall.soonTitle');
  const hint = joinState === 'before'
    ? t('videoCall.opensBefore')
    : joinState === 'open' ? t('videoCall.openNow') : null;
  const showJoin = Boolean(view?.canShowZoom);
  const action = getSawaaRoles(scheme).action;

  return (
    <AquaBackground style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 160 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t('videoCall.title')} onBack={() => router.back()} />

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : notFound || !view ? (
          <ThemedCard padding={20}>
            <ThemedText variant="body" align="center">
              {t('videoCall.bookingNotFound')}
            </ThemedText>
          </ThemedCard>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={[styles.iconCircle, { backgroundColor: isOpen ? action.fill : colors.teal[50] }]}>
                <Video size={40} color={isOpen ? action.foreground : colors.teal[700]} strokeWidth={1.75} />
              </View>
              <Text accessibilityRole="header" style={[styles.heroTitle, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700') }]}>
                {title}
              </Text>
              {view.counterpartyName ? (
                <Text style={[styles.heroSub, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400') }]}>
                  {t('appointments.with', { name: view.counterpartyName })}
                </Text>
              ) : null}
            </View>

            <InfoRows
              rows={[
                { icon: Calendar, label: t('videoCall.timeLabel'), value: formattedTime || '—' },
                { icon: Briefcase, label: t('videoCall.serviceLabel'), value: view.serviceName || '—' },
                { icon: Clock, label: t('videoCall.durationLabel'), value: t('appointments.durationMins', { count: view.durationMins }) },
              ]}
            />
          </>
        )}
      </ScrollView>

      {view && showJoin ? (
        <FloatingCta>
          {hint ? (
            <Text style={[styles.hint, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400') }]}>{hint}</Text>
          ) : null}
          <JoinVideoCallButton
            url={view.url}
            scheduledAt={view.scheduledAt}
            durationMins={view.durationMins}
            status={view.meetingStatus}
            isRTL={dir.isRTL}
            variant={role === 'employee' ? 'start' : 'join'}
            fullWidth
          />
        </FloatingCta>
      ) : null}
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, direction: 'ltr' },
  scroll: { flexGrow: 1, paddingHorizontal: 16, gap: 20 },
  loaderWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  hero: { alignItems: 'center', gap: 8, paddingTop: 12 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  heroTitle: { fontSize: 22, lineHeight: 30, textAlign: 'center' },
  heroSub: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  hint: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
