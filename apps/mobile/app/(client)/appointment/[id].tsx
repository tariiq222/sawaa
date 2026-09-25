import React, { useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Video,
  XCircle,
} from 'lucide-react-native';

import { AquaBackground, PrimaryButton, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useBooking, useCancelBooking } from '@/hooks/queries';
import { JoinVideoCallButton } from '@/components/features/JoinVideoCallButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { STATUS_LABEL_MAP } from '@/lib/status-helpers';
import { hasZoomMeetingAccess, resolveDeliveryType } from '@/types/booking-enums';

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
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const { data: booking, isLoading, isError, refetch } = useBooking(id);
  const cancelMutation = useCancelBooking();
  const cancelling = cancelMutation.isPending;

  const therapistName = booking
    ? (dir.isRTL
        ? booking.employee?.nameAr ?? booking.employee?.nameEn
        : booking.employee?.nameEn ?? booking.employee?.nameAr) ?? '—'
    : '—';
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
    { icon: <Video size={18} color={colors.accent.violet} strokeWidth={1.75} />, color: colors.accent.violet, labelAr: 'نوع الجلسة', labelEn: 'Session type', value: isOnline ? (dir.isRTL ? 'جلسة عن بُعد' : 'Remote session') : (dir.isRTL ? 'حضوري' : 'In person') },
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
                onSuccess: () => router.back(),
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
          <Glass variant="strong" radius={22} onPress={() => router.back()} interactive accessibilityLabel={t('a11y.buttonBack')} style={styles.backBtn}>
            <BackIcon size={22} color={colors.ink[700]} strokeWidth={1.75} />
          </Glass>
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
          <Glass variant="strong" radius={22} onPress={() => router.back()} interactive accessibilityLabel={t('a11y.buttonBack')} style={[styles.backBtn, { alignSelf: dir.alignStart }]}>
            <BackIcon size={22} color={colors.ink[700]} strokeWidth={1.75} />
          </Glass>
        </Animated.View>

        {/* Hero therapist */}
        <Animated.View entering={FadeInDown.delay(80).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.heroCard}>
            <View style={[styles.heroRow, { flexDirection: dir.row }]}>
              <LinearGradient
                colors={theme.colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={[styles.avatarText, { fontFamily: f700 }]}>ف</Text>
                <View style={styles.onlineDot} />
              </LinearGradient>
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
                <View style={[styles.rowIcon, { backgroundColor: `${r.color}1e` }]}>{r.icon}</View>
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
      </Animated.View>

      {/* Cancel link */}
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
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>, themeColors: ReturnType<typeof useTheme>['theme']['colors']) => StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  heroCard: { padding: 16 },
  heroRow: { alignItems: 'center', gap: 14 },
  avatar: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  avatarText: { fontSize: 26, color: themeColors.primaryForeground },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.teal[500], borderWidth: 2, borderColor: colors.glass.opaqueBg,
  },
  heroMid: { flex: 1 },
  heroName: { fontSize: 16, color: colors.ink[900] },
  heroSpec: { fontSize: 12, color: colors.ink[500], marginTop: 2 },
  statusContainer: { marginTop: 8 },
  card: { padding: 0 },
  row: { alignItems: 'center', gap: 14, padding: 14 },
  rowDivider: { borderBottomWidth: 0.5, borderBottomColor: colors.glass.border },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowMid: { flex: 1 },
  rowLabel: { fontSize: 11, color: colors.ink[500] },
  rowValue: { fontSize: 13.5, color: colors.ink[900], marginTop: 2 },
  sectionTitle: { fontSize: 14, color: colors.ink[900], marginBottom: 8, paddingHorizontal: 4 },
  ctaWrap: { position: 'absolute', left: 16, right: 16, gap: 10, alignItems: 'stretch' },
  secondaryBtn: { flex: 1 },
  secondaryGlass: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, gap: 8,
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
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cancelText: { fontSize: 12, color: colors.accent.coral },
});
