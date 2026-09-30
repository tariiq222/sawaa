import { useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { View, ScrollView, Pressable, Linking, Alert, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Video,
  Calendar,
  Clock,
  Check,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Glass } from '@/theme/components/Glass';
import {
  AquaBackground,
  PrimaryButton,
  sawaaRadius,
  sawaaSpacing,
  withAlpha,
} from '@/theme/sawaa';
import { StatusPill } from '@/components/ui/StatusPill';
import { Skeleton } from '@/components/ui/Skeleton';
import { FloatingActionBar } from '@/components/ui/FloatingActionBar';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { goBackOrHome } from '@/lib/navigation';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import {
  useCancelEmployeeBooking,
  useRequestCancelEmployeeBooking,
  useEmployeeBooking,
  useMarkEmployeeBookingCompleted,
  useStartEmployeeBookingSession,
} from '@/hooks/queries';
import { useAppSelector } from '@/hooks/use-redux';
import { getStatusLabel } from '@/lib/status-helpers';
import { JoinVideoCallButton } from '@/components/features/JoinVideoCallButton';
import { hasZoomMeetingAccess, resolveBookingType, resolveDeliveryType } from '@/types/booking-enums';
import { createStyles } from '@/components/features/employee-appointment-styles';
import { hasBookingPermission, resolveCancellationMode } from '@/lib/employee-booking-actions';

const getTypeMeta = (colors: ReturnType<typeof useSawaaColors>): Record<string, { icon: React.ElementType; color: string }> => ({
  individual: { icon: Building2, color: colors.accent.sky },
  in_person: { icon: Building2, color: colors.accent.sky },
  online: { icon: Video, color: colors.accent.violet },
  walk_in: { icon: Building2, color: colors.teal[500] },
  group: { icon: Building2, color: colors.accent.violet },
});

export default function DoctorAppointmentDetailScreen() {
  const { theme } = useTheme();
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const TYPE_META = getTypeMeta(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const handleBack = () => goBackOrHome(router, '/(employee)/(tabs)/today');
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const user = useAppSelector((state) => state.auth.user);
  const bookingQuery = useEmployeeBooking(id);
  const markCompleted = useMarkEmployeeBookingCompleted();
  const startSession = useStartEmployeeBookingSession();
  const cancelBooking = useCancelEmployeeBooking();
  const requestCancelBooking = useRequestCancelEmployeeBooking();
  const booking = bookingQuery.isError ? null : (bookingQuery.data ?? null);
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
  const typeMetaKey = isOnline ? 'online' : bookingType;
  const meta = TYPE_META[typeMetaKey] ?? TYPE_META.individual;
  const TypeIcon = meta.icon;

  const handleMarkComplete = () => {
    Alert.alert(t('doctor.markCompleted'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          try {
            await markCompleted.mutateAsync(booking.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            handleBack();
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t('common.error'), t('common.error'));
          }
        },
      },
    ]);
  };

  const handleStartSession = () => {
    Alert.alert(t('doctor.startSession'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          try {
            await startSession.mutateAsync(booking.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t('common.error'), t('common.error'));
          }
        },
      },
    ]);
  };

  const handleEmployeeCancel = () => {
    Alert.alert(t('doctor.cancelBooking'), t('doctor.cancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelBooking.mutateAsync(booking.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            handleBack();
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t('common.error'), t('common.error'));
          }
        },
      },
    ]);
  };

  const handleRequestCancel = () => {
    Alert.alert(t('appointments.requestCancel'), t('doctor.requestCancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
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
          }
        },
      },
    ]);
  };

  const hasUpdate = hasBookingPermission(user, 'update');
  const isCheckedIn = !!booking.checkedInAt;
  const canStartSession = hasUpdate && booking.status === 'confirmed' && !isCheckedIn;
  const canComplete = hasUpdate && booking.status === 'confirmed' && isCheckedIn;
  const canCancelStatus = booking.status === 'confirmed' || booking.status === 'pending';
  const cancellationMode = canCancelStatus ? resolveCancellationMode(user) : 'none';
  const hasBarActions = canStartSession || canComplete || cancellationMode !== 'none';

  const infoRows: { icon: React.ElementType; color: string; text: string }[] = [
    {
      icon: TypeIcon,
      color: meta.color,
      text: t(`booking.${isOnline ? 'online' : bookingType === 'walk_in' ? 'walkIn' : bookingType === 'group' ? 'group' : 'inPerson'}`),
    },
    {
      icon: Calendar,
      color: colors.accent.sky,
      text: new Date(booking.date).toLocaleDateString(dir.isRTL ? 'ar-SA' : 'en-US', { month: 'long', day: 'numeric' }),
    },
    { icon: Clock, color: colors.accent.amber, text: `${booking.startTime} — ${booking.endTime}` },
  ];

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + (hasBarActions ? 120 : sawaaSpacing.xl) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <BackButton onPress={handleBack} style={{ alignSelf: dir.alignStart }} accessibilityLabel={t('common.back')} />

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}
          style={[styles.headerRow, { flexDirection: dir.row }]}
        >
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {t('appointments.details')}
          </Text>
          <StatusPill status={booking.status} label={t(getStatusLabel(booking.status))} />
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} padding={sawaaSpacing.lg} style={styles.infoCard}>
            <View style={styles.infoList}>
              {infoRows.map((row) => {
                const RowIcon = row.icon;
                return (
                  <View key={row.text} style={[styles.infoRow, { flexDirection: dir.row }]}>
                    <View style={[styles.iconCircle, { backgroundColor: withAlpha(row.color, 0.12) }]}>
                      <RowIcon size={16} strokeWidth={1.5} color={row.color} />
                    </View>
                    <Text style={[styles.infoText, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                      {row.text}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Glass>
        </Animated.View>

        {canShowZoom && (booking.zoomMeetingStatus || booking.zoomStartUrl || booking.zoomJoinUrl) && booking.scheduledAt && booking.durationMins ? (
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(180).duration(600).easing(Easing.out(Easing.cubic))}>
            <JoinVideoCallButton
              url={booking.zoomStartUrl ?? booking.zoomJoinUrl ?? null}
              scheduledAt={booking.scheduledAt}
              durationMins={booking.durationMins}
              status={booking.zoomMeetingStatus ?? null}
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
        <FloatingActionBar>
          {canStartSession && (
            <PrimaryButton
              label={t('doctor.startSession')}
              onPress={handleStartSession}
              fontFamily={f600}
              style={styles.barAction}
              icon={<Check size={16} color={theme.colors.primaryForeground} />}
            />
          )}
          {canComplete && (
            <PrimaryButton
              label={t('doctor.markCompleted')}
              onPress={handleMarkComplete}
              fontFamily={f600}
              style={styles.barAction}
              icon={<Check size={16} color={theme.colors.primaryForeground} />}
            />
          )}
          {cancellationMode !== 'none' && (
            <Pressable
              onPress={cancellationMode === 'direct_cancel' ? handleEmployeeCancel : handleRequestCancel}
              accessibilityRole="button"
              style={styles.barAction}
            >
              <Glass variant="strong" radius={sawaaRadius.pill}>
                <View style={styles.cancelInner}>
                  <Text style={[styles.cancelText, { fontFamily: f600, fontWeight: '600', writingDirection: dir.writingDirection }]}>
                    {cancellationMode === 'direct_cancel'
                      ? t('doctor.cancelBooking')
                      : t('appointments.requestCancel')}
                  </Text>
                </View>
              </Glass>
            </Pressable>
          )}
        </FloatingActionBar>
      )}
    </AquaBackground>
  );
}
