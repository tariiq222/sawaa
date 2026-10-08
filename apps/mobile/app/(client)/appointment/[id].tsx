import React from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Calendar,
  Clock,
  MapPin,
  Video,
} from 'lucide-react-native';

import { AquaBackground, PrimaryButton, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { useBooking } from '@/hooks/queries';
import { BookingCancellation } from '@/components/features/BookingCancellation';
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
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f700 = getFontName(dir.locale, '700');
  const { data: booking, isLoading, isError, refetch } = useBooking(id);

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

  if (isLoading || isError || !booking) {
    return (
      <AquaBackground>
        <View style={[styles.screen, { paddingTop: insets.top + sawaaSpacing.md }]}>
          <View style={styles.header}>
            <ScreenHeader title={t('appointments.details')} onBack={handleBack} />
          </View>
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + sawaaSpacing['2xl'] }]}>
          <EmptyState
            icon={isError ? 'alert-circle-outline' : 'calendar-outline'}
            title={t(isLoading ? 'common.loading' : isError ? 'common.error' : 'common.noResults')}
            tone={isError ? 'danger' : 'default'}
            actionLabel={isError ? t('common.retry') : undefined}
            onAction={isError ? () => { void refetch(); } : undefined}
          />
          </ScrollView>
        </View>
      </AquaBackground>
    );
  }

  return (
    <AquaBackground>
      <View style={[styles.screen, { paddingTop: insets.top + sawaaSpacing.md }]}>
        <View style={styles.header}>
          <ScreenHeader title={t('appointments.details')} onBack={handleBack} />
        </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + sawaaSpacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.summary}>
            <View style={{ alignItems: dir.alignEnd }}>
              <StatusPill
                status={booking.status}
                label={STATUS_LABEL_MAP[booking.status] ? t(STATUS_LABEL_MAP[booking.status]) : '—'}
              />
            </View>
            <View style={[styles.summaryTop, { flexDirection: dir.row }]}>
              <DateBox iso={booking.scheduledAt} fallback={t('appointments.toBeScheduled')} />
              <View style={styles.summaryMid}>
                <Text style={[styles.time, { color: colors.ink[900], fontFamily: f700, textAlign: dir.textAlign }]}>
                  {scheduledTime ?? t('appointments.toBeScheduled')}
                </Text>
                {serviceName ? (
                  <Text testID="appointment-service-name" style={[styles.service, { color: colors.ink[900], fontFamily: f500, textAlign: dir.textAlign }]}>
                    {serviceName}
                  </Text>
                ) : null}
                <Text style={[styles.therapist, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>
                  {t('appointments.with', { name: therapistName })}
                </Text>
              </View>
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

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(500).easing(Easing.out(Easing.cubic))} style={styles.section}>
          <InfoRows rows={rows} layout="stacked" />
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

        <BookingCancellation bookingId={booking.id} canCancel={canCancel} persistedRefund={booking.cancellationRefund} />
      </ScrollView>
      </View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: sawaaSpacing.lg, paddingBottom: sawaaSpacing.xl },
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.xl },
  summary: { padding: sawaaSpacing.xl, gap: sawaaSpacing.md },
  summaryTop: { alignItems: 'center', gap: sawaaSpacing.md },
  summaryMid: { flex: 1, minWidth: 0, gap: sawaaSpacing.xs },
  time: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  service: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  therapist: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  section: { gap: sawaaSpacing.sm },
  hint: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight, paddingHorizontal: sawaaSpacing.xs },
});
