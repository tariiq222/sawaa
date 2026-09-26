import { View, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Calendar, User as UserIcon, Briefcase } from 'lucide-react-native';
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
import { withAlpha } from '@/theme/sawaa/tokens';

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
  // The employee mapper doesn't always emit `scheduledAt`; reconstruct from
  // the `date` + `startTime` pair which is always present.
  const scheduledAt =
    b.scheduledAt ??
    new Date(`${b.date}T${b.startTime}:00.000Z`).toISOString();
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
  const { theme } = useTheme();
  const dir = useDir();
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;

  const clientBookingQuery = useBooking(role === 'client' ? bookingId : undefined);
  const employeeBookingQuery = useEmployeeBooking(role === 'employee' ? bookingId : undefined);
  const loading = role === 'client' ? clientBookingQuery.isLoading : employeeBookingQuery.isLoading;
  const view = role === 'client'
    ? clientBookingQuery.data ? adaptClient(clientBookingQuery.data, dir.isRTL) : null
    : employeeBookingQuery.data ? adaptEmployee(employeeBookingQuery.data, dir.isRTL) : null;
  const queryError = role === 'client' ? clientBookingQuery.isError : employeeBookingQuery.isError;
  const notFound = !bookingId || (!loading && (queryError || !view));

  const formattedTime = view
    ? new Date(view.scheduledAt).toLocaleString(dir.isRTL ? 'ar-SA' : 'en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  return (
    <AquaBackground style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerRow, { flexDirection: dir.row }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <BackIcon size={24} strokeWidth={1.5} color={theme.colors.textPrimary} />
          </Pressable>
          <ThemedText variant="subheading">{t('videoCall.title')}</ThemedText>
          <View style={styles.backBtn} />
        </View>

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
            <ThemedCard padding={20} style={styles.summaryCard}>
              <InfoRow
                icon={Briefcase}
                color={theme.colors.primary}
                label={t('videoCall.serviceLabel')}
                value={view.serviceName || '—'}
              />
              <InfoRow
                icon={UserIcon}
                color={theme.colors.accent}
                label={t('videoCall.withLabel')}
                value={view.counterpartyName || '—'}
              />
              <InfoRow
                icon={Calendar}
                color={theme.colors.success}
                label={t('videoCall.timeLabel')}
                value={formattedTime}
              />
            </ThemedCard>

            {view.canShowZoom ? (
              <View style={styles.buttonWrap}>
                <JoinVideoCallButton
                  url={view.url}
                  scheduledAt={view.scheduledAt}
                  durationMins={view.durationMins}
                  status={view.meetingStatus}
                  isRTL={dir.isRTL}
                  variant={role === 'employee' ? 'start' : 'join'}
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </AquaBackground>
  );
}

function InfoRow({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: React.ElementType;
  color: string;
  label: string;
  value: string;
}) {
  const { theme } = useTheme();
  const dir = useDir();
  return (
    <View style={[styles.infoRow, { flexDirection: dir.row }]}>
      <View style={[styles.iconCircle, { backgroundColor: withAlpha(color, 0.1) }]}>
        <Icon size={20} strokeWidth={1.5} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText variant="caption" color={theme.colors.textSecondary}>
          {label}
        </ThemedText>
        <ThemedText variant="body">{value}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, direction: 'ltr' },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  loaderWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  summaryCard: { marginBottom: 16, gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWrap: { marginTop: 8 },
});
