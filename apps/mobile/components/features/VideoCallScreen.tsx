import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Calendar, User as UserIcon, Briefcase } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { useTheme } from '@/theme/useTheme';
import { useDir } from '@/hooks/useDir';
import { JoinVideoCallButton } from '@/components/features/JoinVideoCallButton';
import { clientBookingsService, type ClientBookingRow } from '@/services/client/bookings';
import { employeeBookingsService } from '@/services/employee/bookings';
import type { Booking } from '@/types/models';

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
  };
}

/**
 * The employee `getById` returns `ApiResponse<Booking>` (`{ data: Booking, ... }`)
 * but some legacy stubs return the bare `Booking`. Narrows safely without an
 * `as unknown as` escape hatch.
 */
function unwrapEmployeeBooking(
  res: { data?: Booking } & Partial<Booking>,
): Booking | null {
  if (res.data && typeof res.data === 'object') return res.data;
  if (typeof res.id === 'string') return res as Booking;
  return null;
}

export function VideoCallScreen({ role }: VideoCallScreenProps) {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const dir = useDir();
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;

  const [view, setView] = useState<BookingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!bookingId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      if (role === 'client') {
        const row = await clientBookingsService.getById(bookingId);
        setView(adaptClient(row, dir.isRTL));
      } else {
        const res = await employeeBookingsService.getById(bookingId);
        const b = unwrapEmployeeBooking(res);
        if (!b) {
          setNotFound(true);
        } else {
          setView(adaptEmployee(b, dir.isRTL));
        }
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [bookingId, dir.isRTL, role]);

  useEffect(() => {
    load();
  }, [load]);

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
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
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
          </>
        )}
      </ScrollView>
    </View>
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
  return (
    <View style={styles.infoRow}>
      <View style={[styles.iconCircle, { backgroundColor: `${color}1A` }]}>
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
  container: { flex: 1 },
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
