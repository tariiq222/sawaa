import React, { useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Building2,
  Calendar,
  Clock,
  MapPin,
  Video,
  XCircle,
} from 'lucide-react-native';

import { AquaBackground, PrimaryButton, sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useBooking, useCancelBooking } from '@/hooks/queries';
import { JoinVideoCallButton } from '@/components/features/JoinVideoCallButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { STATUS_LABEL_MAP } from '@/lib/status-helpers';
import { hasZoomMeetingAccess, resolveDeliveryType } from '@/types/booking-enums';
import { BackButton } from '@/components/ui/BackButton';

export default function AppointmentDetailScreen() {
  const colors = useSawaaColors();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(colors, theme.colors), [colors, theme.colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f700 = getFontName(dir.locale, '700');
  const { data: booking, isLoading, isError, refetch } = useBooking(id);
  const cancelMutation = useCancelBooking();
  const cancelling = cancelMutation.isPending;

  const therapistName = booking
    ? (dir.isRTL
        ? booking.employee?.nameAr ?? booking.employee?.nameEn
        : booking.employee?.nameEn ?? booking.employee?.nameAr) ?? '—'
    : '—';
  const therapistInitial = Array.from(therapistName.trim())[0] ?? '—';
  const therapistAvatarUrl = booking?.employee?.avatarUrl ?? null;
  const deliveryType = booking
    ? resolveDeliveryType(booking.deliveryType)
    : 'in_person';
  const isOnline = deliveryType === 'online';
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
  const hasScheduledTime = Boolean(booking?.scheduledAt);
  const scheduledDate = booking && hasScheduledTime
    ? new Date(booking.scheduledAt).toLocaleDateString(dir.isRTL ? 'ar-SA' : 'en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : t('appointments.toBeScheduled');
  const scheduledTime = booking && hasScheduledTime
    ? `${new Date(booking.scheduledAt).toLocaleTimeString(dir.isRTL ? 'ar-SA' : 'en-US', {
        hour: 'numeric', minute: '2-digit',
      })} · ${booking.durationMins} ${dir.isRTL ? 'دقيقة' : 'min'}`
    : t('appointments.toBeScheduled');
  const branchLocation = booking
    ? (dir.isRTL
        ? booking.branch?.nameAr ?? booking.branch?.nameEn
        : booking.branch?.nameEn ?? booking.branch?.nameAr) ?? '—'
    : '—';

  const rows = [
    { icon: <Calendar size={18} color={colors.teal[600]} strokeWidth={1.75} />, color: colors.teal[600], labelAr: 'التاريخ', labelEn: 'Date', value: scheduledDate },
    { icon: <Clock size={18} color={colors.accent.amber} strokeWidth={1.75} />, color: colors.accent.amber, labelAr: 'الوقت', labelEn: 'Time', value: scheduledTime },
    { icon: isOnline ? <Video size={18} color={colors.accent.violet} strokeWidth={1.75} /> : <Building2 size={18} color={colors.accent.violet} strokeWidth={1.75} />, color: colors.accent.violet, labelAr: 'نوع الجلسة', labelEn: 'Session type', value: isOnline ? (dir.isRTL ? 'جلسة عن بُعد' : 'Remote session') : (dir.isRTL ? 'حضوري' : 'In person') },
    { icon: <MapPin size={18} color={colors.accent.rose} strokeWidth={1.75} />, color: colors.accent.rose, labelAr: 'الموقع', labelEn: 'Location', value: isOnline ? (dir.isRTL ? 'تُحدد طريقة الاتصال قبل الموعد' : 'Connection method confirmed before session') : branchLocation },
  ];

  const askCancel = () => {
    if (!id || cancelling) return;
    Alert.alert(
      dir.isRTL ? 'إلغاء الموعد' : 'Cancel booking',
      dir.isRTL ? 'هل تريد إلغاء هذا الموعد؟' : 'Cancel this booking?',
      [
        { text: dir.isRTL ? 'رجوع' : 'Back', style: 'cancel' },
        {
          text: dir.isRTL ? 'إلغاء الموعد' : 'Cancel',
          style: 'destructive',
          onPress: () => {
            cancelMutation.mutate(
              { id, reason: dir.isRTL ? 'إلغاء من العميل' : 'Client cancelled' },
              {
                onSuccess: (result) => {
                  if (result.status === 'cancel_requested') {
                    Alert.alert(
                      t('appointments.cancellationRequestedTitle'),
                      t('appointments.cancellationRequestedMessage'),
                    );
                    return;
                  }
                  router.back();
                },
                onError: (err) => {
                  Alert.alert(
                    dir.isRTL ? 'تعذّر الإلغاء' : 'Cancel failed',
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
          <BackButton onPress={() => router.back()} style={styles.backBtn} />
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)}>
          <BackButton onPress={() => router.back()} style={styles.backBtn} />
        </Animated.View>

        {/* Hero therapist */}
        <Animated.View entering={FadeInDown.delay(80).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.heroCard}>
            <View style={[styles.heroRow, { flexDirection: dir.row }]}>
              {therapistAvatarUrl ? (
                <Image source={{ uri: therapistAvatarUrl }} accessibilityLabel={therapistName} style={styles.avatar} />
              ) : (
                <LinearGradient
                  colors={theme.colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatar}
                >
                  <Text style={[styles.avatarText, { fontFamily: f700 }]}>{therapistInitial}</Text>
                </LinearGradient>
              )}
              <View style={styles.heroMid}>
                <Text style={[styles.heroName, { fontFamily: f700, textAlign: dir.textAlign }]}>
                  {therapistName}
                </Text>
                <Text style={[styles.heroSpec, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
                  {(dir.isRTL ? booking?.service?.nameAr : booking?.service?.nameEn) ?? ''}
                </Text>
                <View style={styles.statusContainer}>
                  <StatusPill status={booking.status} label={STATUS_LABEL_MAP[booking.status] ? t(STATUS_LABEL_MAP[booking.status]) : '—'} />
                </View>
              </View>
            </View>
          </Glass>
        </Animated.View>

        {/* Rows */}
        <Animated.View entering={FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
            {rows.map((r, i) => (
              <View
                key={`row-${i}`}
                style={[
                  styles.row,
                  { flexDirection: dir.row },
                  i < rows.length - 1 && styles.rowDivider,
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: withAlpha(r.color, 0.12) }]}>{r.icon}</View>
                <View style={styles.rowMid}>
                  <Text style={[styles.rowLabel, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
                    {dir.isRTL ? r.labelAr : r.labelEn}
                  </Text>
                  <Text style={[styles.rowValue, { fontFamily: f700, textAlign: dir.textAlign }]}>
                    {r.value}
                  </Text>
                </View>
              </View>
            ))}
          </Glass>
        </Animated.View>

        {canResumePayment ? (
          <Animated.View entering={FadeInDown.delay(300).duration(700)}>
            <PrimaryButton
              label={t('appointments.completePayment')}
              onPress={() => router.push({
                pathname: '/(client)/booking/checkout',
                params: { bookingId: booking!.id, invoiceId: booking!.invoiceId! },
              })}
              fontFamily={f700}
            />
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Bottom actions */}
      <Animated.View
        entering={FadeInDown.delay(360).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.ctaWrap, { bottom: insets.bottom + 20, flexDirection: dir.row }]}
      >
        {canShowZoom && booking ? (
          <JoinVideoCallButton
            url={booking.zoomJoinUrl ?? booking.zoomLink ?? null}
            scheduledAt={booking.scheduledAt}
            durationMins={booking.durationMins}
            status={booking.zoomMeetingStatus}
            isRTL={dir.isRTL}
            variant="join"
          />
        ) : null}
        {canRate && booking ? (
          <PrimaryButton
            label={t('appointments.rate')}
            onPress={() => router.push(`/(client)/rate/${booking.id}`)}
            fontFamily={f700}
          />
        ) : null}
      </Animated.View>

      {/* Cancel link */}
      {canCancel ? (
        <Animated.View
          entering={FadeInDown.delay(460).duration(800).easing(Easing.out(Easing.cubic))}
          style={[styles.cancelRow, { bottom: insets.bottom + 80 }]}
        >
          <Pressable onPress={askCancel} disabled={cancelling} style={styles.cancelBtn}>
            <XCircle size={14} color={colors.accent.coral} strokeWidth={2} />
            <Text style={[styles.cancelText, { fontFamily: f500, fontWeight: '500' }]}>
              {cancelling
                ? (dir.isRTL ? 'جاري الإلغاء…' : 'Cancelling…')
                : (dir.isRTL ? 'إلغاء الموعد' : 'Cancel booking')}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>, themeColors: ReturnType<typeof useTheme>['theme']['colors']) => StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  backBtn: { alignSelf: 'flex-start' },
  heroCard: { padding: sawaaSpacing.xl },
  heroRow: { alignItems: 'center', gap: sawaaSpacing.lg },
  avatar: {
    width: 64, height: 64, borderRadius: sawaaRadius.lg,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  avatarText: { fontSize: sawaaType.heading.fontSize, color: themeColors.primaryForeground },
  heroMid: { flex: 1 },
  heroName: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight, color: colors.ink[900] },
  heroSpec: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight, color: colors.ink[500], marginTop: sawaaSpacing.xs },
  statusContainer: { marginTop: sawaaSpacing.sm, alignSelf: 'flex-start' },
  card: { padding: 0 },
  row: { alignItems: 'center', gap: sawaaSpacing.lg, padding: sawaaSpacing.lg },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.glass.border },
  rowIcon: { width: 40, height: 40, borderRadius: sawaaRadius.sm, alignItems: 'center', justifyContent: 'center' },
  rowMid: { flex: 1 },
  rowLabel: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight, color: colors.ink[500] },
  rowValue: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[900], marginTop: sawaaSpacing.xs },
  sectionTitle: { fontSize: sawaaType.body.fontSize, color: colors.ink[900], marginBottom: sawaaSpacing.sm, paddingHorizontal: sawaaSpacing.xs },
  ctaWrap: { position: 'absolute', left: sawaaSpacing.lg, right: sawaaSpacing.lg, gap: sawaaSpacing.md, alignItems: 'stretch' },
  secondaryBtn: { flex: 1 },
  secondaryGlass: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, gap: sawaaSpacing.sm,
  },
  secondaryText: { color: colors.teal[700], fontSize: 13 },
  primaryBtn: { flex: 1.4 },
  primaryGradient: {
    borderRadius: 999, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: colors.teal[600], shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  primaryText: { color: themeColors.primaryForeground, fontSize: 13.5 },
  cancelRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: sawaaSpacing.xs, paddingVertical: sawaaSpacing.sm },
  cancelText: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight, color: colors.accent.coral },
});
