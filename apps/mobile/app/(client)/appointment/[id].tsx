import React from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Video,
  XCircle,
} from 'lucide-react-native';

import { AquaBackground, PrimaryButton, sawaaRadius, sawaaSpacing } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useBooking, useCancelBooking } from '@/hooks/queries';
import { JoinVideoCallButton } from '@/components/features/JoinVideoCallButton';
import { DateBox } from '@/components/ui/DateBox';
import { EmptyState } from '@/components/ui/EmptyState';
import { InfoRows, type InfoRow } from '@/components/ui/InfoRows';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { STATUS_LABEL_MAP } from '@/lib/status-helpers';
import { getBookingServiceName } from '@/lib/booking-service-name';
import { formatLongDate, formatTimeOfDay } from '@/lib/session-format';
import { hasZoomMeetingAccess, resolveDeliveryType } from '@/types/booking-enums';
import { goBackOrHome } from '@/lib/navigation';

export default function AppointmentDetailScreen() {
  const colors = useSawaaColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const handleBack = () => goBackOrHome(router, '/(client)/(tabs)/appointments');
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f700 = getFontName(dir.locale, '700');
  const { data: booking, isLoading, isError, refetch } = useBooking(id);
  const cancelMutation = useCancelBooking();
  const cancelling = cancelMutation.isPending;
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;

  const therapistName = booking
    ? (dir.isRTL
        ? booking.employee?.nameAr ?? booking.employee?.nameEn
        : booking.employee?.nameEn ?? booking.employee?.nameAr) ?? '—'
    : '—';
  const serviceName = booking ? getBookingServiceName(booking, dir.isRTL) : null;
  const isOnline = booking ? resolveDeliveryType(booking.deliveryType) === 'online' : false;
  const canShowZoom = booking ? hasZoomMeetingAccess(booking) : false;
  const canResumePayment = Boolean(
    booking?.invoiceId &&
      !['cancelled', 'expired', 'no_show', 'completed', 'cancel_requested'].includes(booking.status) &&
      !['PAID', 'DEPOSIT_PAID', 'CANCELLED', 'VOID', 'REFUNDED'].includes((booking.invoiceStatus ?? '').toUpperCase()) &&
      (booking.status === 'pending' ||
        booking.status === 'awaiting_payment' ||
        booking.invoiceStatus === 'PARTIALLY_PAID' ||
        booking.invoiceStatus === 'DRAFT' ||
        booking.invoiceStatus === 'ISSUED'),
  );
  const canRate = booking?.status === 'completed'
    && booking.hasRated !== true
    && booking.ratingSubmittedLocally !== true;
  const bookingType = booking?.bookingType?.toLowerCase();
  const legacyType = booking?.type?.toLowerCase();
  const canCancel = Boolean(booking && bookingType !== 'group' && legacyType !== 'group' && [
    'pending', 'awaiting_payment', 'deposit_paid', 'confirmed',
  ].includes(booking.status));
  const scheduledTime = booking ? formatTimeOfDay(booking.scheduledAt, dir.isRTL) : null;
  const scheduledDate = booking ? formatLongDate(booking.scheduledAt, dir.isRTL) : null;
  const branchLocation = booking
    ? (dir.isRTL
        ? booking.branch?.nameAr ?? booking.branch?.nameEn
        : booking.branch?.nameEn ?? booking.branch?.nameAr) ?? '—'
    : '—';

  const rows: InfoRow[] = [
    { icon: Calendar, label: t('appointments.date'), value: scheduledDate ?? t('appointments.toBeScheduled') },
    {
      icon: Clock,
      label: t('appointments.duration'),
      value: t('appointments.durationMins', { count: booking?.durationMins ?? 0 }),
    },
    {
      icon: isOnline ? Video : Building2,
      label: t('appointments.sessionType'),
      value: isOnline ? t('appointments.remoteSession') : t('appointments.inPerson'),
    },
    ...(isOnline ? [] : [{ icon: MapPin, label: t('appointments.location'), value: branchLocation }]),
  ];

  const askCancel = () => {
    if (!id || cancelling) return;
    Alert.alert(
      t('appointments.cancelAppointment'),
      t('appointments.cancelConfirmMessage'),
      [
        { text: t('common.back'), style: 'cancel' },
        {
          text: t('appointments.cancelAppointment'),
          style: 'destructive',
          onPress: () => {
            cancelMutation.mutate(
              { id, reason: t('appointments.cancelReason') },
              {
                onSuccess: (result) => {
                  if (result.status === 'cancel_requested') {
                    Alert.alert(
                      t('appointments.cancellationRequestedTitle'),
                      t('appointments.cancellationRequestedMessage'),
                    );
                    return;
                  }
                  handleBack();
                },
                onError: (err) => {
                  Alert.alert(
                    t('appointments.cancelFailed'),
                    err instanceof Error ? err.message : String(err),
                  );
                },
              },
            );
          },
        },
      ],
    );
  };

  if (isLoading || isError || !booking) {
    return (
      <AquaBackground>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
          <ScreenHeader title={t('appointments.details')} onBack={handleBack} />
          <EmptyState
            icon={isError ? 'alert-circle-outline' : 'calendar-outline'}
            title={t(isLoading ? 'common.loading' : isError ? 'common.error' : 'common.noResults')}
            tone={isError ? 'danger' : 'default'}
            actionLabel={isError ? t('common.retry') : undefined}
            onAction={isError ? () => { void refetch(); } : undefined}
          />
        </ScrollView>
      </AquaBackground>
    );
  }

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + sawaaSpacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t('appointments.details')} onBack={handleBack} />

        <Animated.View entering={FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.summary}>
            <View style={[styles.summaryTop, { flexDirection: dir.row }]}>
              <DateBox iso={booking.scheduledAt} fallback={t('appointments.toBeScheduled')} />
              <View style={styles.summaryMid}>
                <Text numberOfLines={1} style={[styles.time, { color: colors.ink[900], fontFamily: f700, textAlign: dir.textAlign }]}>
                  {scheduledTime ?? t('appointments.toBeScheduled')}
                </Text>
                {serviceName ? (
                  <Text testID="appointment-service-name" numberOfLines={2} style={[styles.therapist, { color: colors.ink[900], fontFamily: f500, textAlign: dir.textAlign }]}>
                    {serviceName}
                  </Text>
                ) : null}
                <Text numberOfLines={1} style={[styles.therapist, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>
                  {t('appointments.with', { name: therapistName })}
                </Text>
              </View>
              <StatusPill
                status={booking.status}
                label={STATUS_LABEL_MAP[booking.status] ? t(STATUS_LABEL_MAP[booking.status]) : '—'}
              />
            </View>
            {canShowZoom ? (
              <JoinVideoCallButton
                url={booking.zoomJoinUrl ?? booking.zoomLink ?? null}
                scheduledAt={booking.scheduledAt}
                durationMins={booking.durationMins}
                status={booking.zoomMeetingStatus}
                isRTL={dir.isRTL}
                variant="join"
                fullWidth
              />
            ) : null}
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(500).easing(Easing.out(Easing.cubic))} style={styles.section}>
          <InfoRows rows={rows} />
          {isOnline ? (
            <Text style={[styles.hint, { color: colors.ink[500], fontFamily: f400, textAlign: dir.textAlign }]}>
              {t('appointments.locationRemote')}
            </Text>
          ) : null}
        </Animated.View>

        {canResumePayment ? (
          <PrimaryButton
            label={t('appointments.completePayment')}
            onPress={() => router.push({
              pathname: '/(client)/booking/checkout',
              params: { bookingId: booking.id, invoiceId: booking.invoiceId! },
            })}
            fontFamily={f700}
          />
        ) : null}

        {canRate ? (
          <PrimaryButton
            label={t('appointments.rate')}
            onPress={() => router.push(`/(client)/rate/${booking.id}`)}
            fontFamily={f700}
          />
        ) : null}

        {canCancel ? (
          <Animated.View entering={FadeInDown.delay(160).duration(500).easing(Easing.out(Easing.cubic))}>
            <Glass variant="base" radius={sawaaRadius.lg}>
              <Pressable
                onPress={askCancel}
                disabled={cancelling}
                accessibilityRole="button"
                accessibilityState={{ disabled: cancelling, busy: cancelling }}
                style={[styles.actionRow, { flexDirection: dir.row }]}
              >
                <XCircle size={22} color={colors.accent.coral} strokeWidth={1.75} />
                <Text style={[styles.actionText, { color: colors.ink[900], fontFamily: f500, textAlign: dir.textAlign }]}>
                  {cancelling ? t('appointments.cancelling') : t('appointments.cancelAppointment')}
                </Text>
                <Chevron size={18} color={colors.ink[400]} strokeWidth={1.75} />
              </Pressable>
            </Glass>
          </Animated.View>
        ) : null}
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.xl },
  summary: { padding: sawaaSpacing.lg, gap: sawaaSpacing.md },
  summaryTop: { alignItems: 'center', gap: sawaaSpacing.md },
  summaryMid: { flex: 1, minWidth: 0, gap: 2 },
  time: { fontSize: 20, lineHeight: 28 },
  therapist: { fontSize: 14, lineHeight: 20 },
  section: { gap: sawaaSpacing.sm },
  hint: { fontSize: 13, lineHeight: 18, paddingHorizontal: sawaaSpacing.xs },
  actionRow: { alignItems: 'center', gap: sawaaSpacing.md, paddingHorizontal: sawaaSpacing.lg, minHeight: 56 },
  actionText: { flex: 1, fontSize: 16 },
});
