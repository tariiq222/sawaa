import { useRef } from 'react';

import { useTheme } from '@/theme/useTheme';
import { View, ScrollView, Linking, Alert } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Video,
  Calendar,
  ClipboardList,
  Clock,
  Check,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import {
  AquaBackground,
  PrimaryButton,
  sawaaRadius,
  sawaaSpacing,
} from '@/theme/sawaa';
import { Skeleton } from '@/components/ui/Skeleton';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { InfoRows, type InfoRow } from '@/components/ui/InfoRows';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { BackButton } from '@/components/ui/BackButton';
import { AppointmentClientCard } from '@/components/features/employee/AppointmentClientCard';
import { OutlineButton } from '@/components/features/employee/OutlineButton';
import { getAppointmentDurationMins, getServiceName } from '@/lib/employee-schedule';
import { EmptyState } from '@/components/ui/EmptyState';
import { goBackOrHome } from '@/lib/navigation';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import {
  useCancelEmployeeBooking,
  useRequestCancelEmployeeBooking,
  useEmployeeBooking,
  useEmployeeMeetingStart,
  useMarkEmployeeBookingCompleted,
  useStartEmployeeBookingSession,
} from '@/hooks/queries';
import { useAppSelector } from '@/hooks/use-redux';
import { getStatusLabel } from '@/lib/status-helpers';
import { JoinVideoCallButton } from '@/components/features/JoinVideoCallButton';
import { hasZoomMeetingAccess, resolveBookingType, resolveDeliveryType } from '@/types/booking-enums';
import { FEATURE_FLAGS } from '@/constants/feature-flags';
import { styles } from '@/components/features/employee-appointment-styles';
import { hasBookingPermission, resolveCancellationMode } from '@/lib/employee-booking-actions';

export default function DoctorAppointmentDetailScreen() {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const handleBack = () => goBackOrHome(router, '/(employee)/(tabs)/today');
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f600 = getFontName(dir.locale, '600');

  const user = useAppSelector((state) => state.auth.user);
  const bookingQuery = useEmployeeBooking(id);
  const markCompleted = useMarkEmployeeBookingCompleted();
  const startSession = useStartEmployeeBookingSession();
  const cancelBooking = useCancelEmployeeBooking();
  const requestCancelBooking = useRequestCancelEmployeeBooking();
  const actionLock = useRef(false);
  const actionPending = Boolean(markCompleted.isPending || startSession.isPending || cancelBooking.isPending || requestCancelBooking.isPending);
  const booking = bookingQuery.isError ? null : (bookingQuery.data ?? null);
  // Exact timing and the host link come from the dedicated start-meeting
  // endpoint; the detail payload carries neither. Skipped while video calls are
  // switched off so the host link is never fetched for a hidden button.
  const meetingStartQuery = useEmployeeMeetingStart(
    id,
    FEATURE_FLAGS.videoCalls && booking ? hasZoomMeetingAccess(booking) : false,
  );
  const meetingStart = meetingStartQuery.data;
  const loading = bookingQuery.isLoading;
  const isError = bookingQuery.isError;

  if (loading) {
    return (
      <AquaBackground>
        <View style={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.md }]}>
          <BackButton onPress={handleBack} style={{ alignSelf: dir.alignStart }} accessibilityLabel={t('common.back')} />
          <Skeleton width="55%" height={24} radius={sawaaRadius.sm} style={styles.loaderTitle} />
          <Skeleton height={160} radius={sawaaRadius.xl} />
          <Skeleton height={52} radius={sawaaRadius.pill} style={styles.loaderAction} />
        </View>
      </AquaBackground>
    );
  }

  if (isError) {
    return (
      <AquaBackground>
        <View style={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.md, flex: 1, justifyContent: 'center' }]}>
          <BackButton onPress={handleBack} style={{ alignSelf: dir.alignStart, marginBottom: sawaaSpacing.lg }} accessibilityLabel={t('common.back')} />
          <EmptyState icon="alert" title={t('common.error')} description={t('common.tryAgain')} actionLabel={t('common.retry')} onAction={() => bookingQuery.refetch()} />
        </View>
      </AquaBackground>
    );
  }
  if (!booking) {
    return (
      <AquaBackground>
        <View style={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.md, flex: 1, justifyContent: 'center' }]}>
          <BackButton onPress={handleBack} style={{ alignSelf: dir.alignStart, marginBottom: sawaaSpacing.lg }} accessibilityLabel={t('common.back')} />
          <EmptyState icon="calendar-outline" title={t('appointments.notFound')} />
        </View>
      </AquaBackground>
    );
  }

  const bookingType = resolveBookingType(booking.bookingType ?? booking.type);
  const deliveryType = resolveDeliveryType(booking.deliveryType);
  const isOnline = deliveryType === 'online';
  const canShowZoom = hasZoomMeetingAccess(booking);
  const TypeIcon = isOnline ? Video : Building2;

  const handleMarkComplete = () => {
    if (actionPending || actionLock.current) return;
    Alert.alert(t('doctor.markCompleted'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          if (actionPending || actionLock.current) return;
          actionLock.current = true;
          try {
            await markCompleted.mutateAsync(booking.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            handleBack();
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t('common.error'), t('common.error'));
          } finally {
            actionLock.current = false;
          }
        },
      },
    ]);
  };

  const handleStartSession = () => {
    if (actionPending || actionLock.current) return;
    Alert.alert(t('doctor.startSession'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          if (actionPending || actionLock.current) return;
          actionLock.current = true;
          try {
            await startSession.mutateAsync(booking.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t('common.error'), t('common.error'));
          } finally {
            actionLock.current = false;
          }
        },
      },
    ]);
  };

  const handleEmployeeCancel = () => {
    if (actionPending || actionLock.current) return;
    Alert.alert(t('doctor.cancelBooking'), t('doctor.cancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          if (actionPending || actionLock.current) return;
          actionLock.current = true;
          try {
            await cancelBooking.mutateAsync(booking.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            handleBack();
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t('common.error'), t('common.error'));
          } finally {
            actionLock.current = false;
          }
        },
      },
    ]);
  };

  const handleRequestCancel = () => {
    if (actionPending || actionLock.current) return;
    Alert.alert(t('appointments.requestCancel'), t('doctor.requestCancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          if (actionPending || actionLock.current) return;
          actionLock.current = true;
          try {
            await requestCancelBooking.mutateAsync(booking.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await bookingQuery.refetch();
            Alert.alert(
              t('appointments.cancellationRequestedTitle'),
              t('appointments.cancellationRequestedMessage'),
            );
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t('common.error'), t('common.error'));
          } finally {
            actionLock.current = false;
          }
        },
      },
    ]);
  };

  const hasUpdate = hasBookingPermission(user, 'update');
  const isCheckedIn = !!booking.checkedInAt;
  const isOperationallyConfirmed = booking.status === 'confirmed' || booking.status === 'deposit_paid';
  const canStartSession = hasUpdate && isOperationallyConfirmed && !isCheckedIn;
  const canComplete = hasUpdate && isOperationallyConfirmed && isCheckedIn;
  const canCancelStatus = booking.status === 'confirmed' || booking.status === 'pending';
  const cancellationMode = canCancelStatus ? resolveCancellationMode(user) : 'none';
  const hasBarActions = canStartSession || canComplete || cancellationMode !== 'none';

  const serviceName = getServiceName(booking, dir.isRTL);
  const durationMins = getAppointmentDurationMins(booking);
  const dateLabel = new Date(booking.date).toLocaleDateString(dir.isRTL ? 'ar-SA' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const infoRows: InfoRow[] = [
    { icon: Calendar, label: t('doctor.detailAppointment'), value: `${dateLabel} · ${booking.startTime}` },
    ...(serviceName ? [{ icon: ClipboardList, label: t('doctor.detailService'), value: serviceName }] : []),
    ...(durationMins !== null ? [{ icon: Clock, label: t('doctor.detailDuration'), value: t('doctor.durationMinutes', { count: durationMins }) }] : []),
    {
      icon: TypeIcon,
      label: t('doctor.detailType'),
      value: t(`booking.${isOnline ? 'online' : bookingType === 'walk_in' ? 'walkIn' : bookingType === 'group' ? 'group' : 'inPerson'}`),
    },
  ];
  const clientName = booking.client
    ? `${booking.client.firstName} ${booking.client.lastName}`
    : t('doctor.clientRecord');

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + (hasBarActions ? 220 : sawaaSpacing.xl) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t('appointments.details')} onBack={handleBack} />

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
          <AppointmentClientCard
            name={clientName}
            avatarUrl={booking.client?.avatarUrl}
            status={booking.status}
            statusLabel={t(getStatusLabel(booking.status))}
            onPress={booking.clientId ? () => router.push(`/(employee)/client/${booking.clientId}`) : undefined}
          />
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(140).duration(600).easing(Easing.out(Easing.cubic))}>
          <InfoRows rows={infoRows} />
        </Animated.View>

        {canShowZoom && meetingStart ? (
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(180).duration(600).easing(Easing.out(Easing.cubic))}>
            <JoinVideoCallButton
              url={meetingStart.startUrl}
              scheduledAt={meetingStart.scheduledAt}
              durationMins={meetingStart.durationMins}
              status={meetingStart.meetingStatus}
              isRTL={dir.isRTL}
              variant="start"
            />
          </Animated.View>
        ) : canShowZoom && booking.zoomLink ? (
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(180).duration(600).easing(Easing.out(Easing.cubic))}>
            <PrimaryButton
              label={t('doctor.startMeeting')}
              onPress={() => Linking.openURL(booking.zoomLink!)}
              fontFamily={f600}
            />
          </Animated.View>
        ) : null}
      </ScrollView>

      {hasBarActions && (
        <FloatingCta>
          {canStartSession && (
            <PrimaryButton
              label={t('doctor.startSession')}
              disabled={actionPending}
              loading={startSession.isPending}
              onPress={handleStartSession}
              fontFamily={f600}
              icon={<Check size={16} color={theme.colors.primaryForeground} />}
            />
          )}
          {canComplete && (
            <PrimaryButton
              label={t('doctor.markCompleted')}
              disabled={actionPending}
              loading={markCompleted.isPending}
              onPress={handleMarkComplete}
              fontFamily={f600}
              icon={<Check size={16} color={theme.colors.primaryForeground} />}
            />
          )}
          {cancellationMode !== 'none' && (
            <OutlineButton
              disabled={actionPending}
              loading={cancelBooking.isPending || requestCancelBooking.isPending}
              tone="neutral"
              onPress={cancellationMode === 'direct_cancel' ? handleEmployeeCancel : handleRequestCancel}
              label={cancellationMode === 'direct_cancel' ? t('doctor.cancelBooking') : t('appointments.requestCancel')}
            />
          )}
        </FloatingCta>
      )}
    </AquaBackground>
  );
}
