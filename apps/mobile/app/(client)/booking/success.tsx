import React, { useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, Check, CircleAlert, Clock, Hash, User, type LucideIcon } from 'lucide-react-native';

import {
  AquaBackground,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
  withAlpha,
} from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { InfoRows, type InfoRow } from '@/components/ui/InfoRows';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { useDir } from '@/hooks/useDir';
import { useTranslation } from 'react-i18next';
import { useReduceMotion } from '@/hooks/useA11y';
import { useBooking } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';
import { resolveConfirmedPhase, usePaymentStatus, type PaymentPhase } from '@/features/booking/use-payment-status';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatWhen(iso: string, isRTL: boolean): string {
  const d = new Date(iso);
  const dayName = isRTL ? DAYS_AR[d.getDay()] : DAYS_EN[d.getDay()];
  const dayNum = isRTL ? d.getDate().toLocaleString('ar-SA') : d.getDate();
  const month = isRTL ? MONTHS_AR[d.getMonth()] : MONTHS_EN[d.getMonth()];
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const suffix = h < 12 ? (isRTL ? 'ص' : 'AM') : (isRTL ? 'م' : 'PM');
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return isRTL
    ? `${dayName} ${dayNum} ${month} · ${h12}:${m} ${suffix}`
    : `${dayName} ${month} ${dayNum} · ${h12}:${m} ${suffix}`;
}

function shortBookingRef(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export default function BookingSuccessScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const { bookingId, invoiceId, paymentId, webResult, amount, currency } = useLocalSearchParams<{
    bookingId?: string;
    invoiceId?: string;
    paymentId?: string;
    webResult?: string;
    amount?: string;
    currency?: string;
  }>();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const bookingQuery = useBooking(bookingId);
  const booking = bookingQuery.data ?? null;
  const loading = Boolean(bookingId) && bookingQuery.isLoading;

  // Payment phase is derived by polling the backend (the source of truth). The
  // WebBrowser result alone is NOT trusted: see use-payment-status for the rules.
  const { phase, checkAgain } = usePaymentStatus(invoiceId, webResult);
  const checkPaymentAndBookingAgain = () => {
    checkAgain();
    if (bookingId) void bookingQuery.refetch();
  };

  // A paid invoice does not guarantee the booking itself has been confirmed yet
  // (e.g. settlement lag or DEPOSIT_PAID). See resolveConfirmedPhase.
  const effectivePhase = resolveConfirmedPhase(
    phase,
    Boolean(invoiceId),
    Boolean(booking) && !bookingQuery.isError,
    booking?.status,
  );

  // The booking and its invoice already exist by the time this screen renders,
  // so a failed payment must resume THAT invoice. Going back with router.back()
  // landed on the wizard (payment was entered with replace), where paying again
  // created a second booking for the same slot — which then failed the slot
  // conflict, leaving the created invoice unreachable from the UI.
  const retryPayment = () => {
    if (!bookingId || !invoiceId) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/(client)/booking/payment',
      params: {
        bookingId,
        invoiceId,
        ...(amount ? { amount } : {}),
        ...(currency ? { currency } : {}),
      },
    });
  };

  const therapistName = booking?.employee
    ? (dir.isRTL ? booking.employee.nameAr : booking.employee.nameEn) ?? booking.employee.nameAr ?? booking.employee.nameEn
    : null;

  const headerCopy: Record<PaymentPhase, { title: string; subtitle: string }> = {
    polling: {
      title: dir.isRTL ? 'جاري تأكيد الدفع' : 'Confirming payment',
      subtitle: dir.isRTL ? 'جاري تحديث حالة الدفع...' : 'Checking payment status...',
    },
    confirmed: {
      title: dir.isRTL ? 'تم تأكيد موعدك' : 'Appointment confirmed',
      subtitle: invoiceId
        ? (dir.isRTL ? 'تم استلام الدفع' : 'Payment received')
        : (dir.isRTL
          ? 'سنتواصل معكِ قريباً لترتيب الدفع وإرسال تفاصيل الجلسة'
          : 'We\'ll reach out shortly to arrange payment and send session details'),
    },
    pending: phase === 'confirmed' ? {
      title: dir.isRTL ? 'جاري تأكيد الموعد' : 'Confirming appointment',
      subtitle: dir.isRTL
        ? 'تم استلام الدفع. نتحقق من حالة الموعد، يمكنكِ المحاولة مرة أخرى.'
        : 'Payment received. Checking the appointment status; you can try again.',
    } : {
      title: dir.isRTL ? 'الدفع قيد المعالجة' : 'Payment processing',
      subtitle: dir.isRTL
        ? 'لم نتلقَّ تأكيد الدفع بعد. يمكنكِ التحقق مرة أخرى.'
        : 'We have not received payment confirmation yet. You can check again.',
    },
    failed: {
      title: dir.isRTL ? 'لم يكتمل الدفع' : 'Payment not completed',
      subtitle: dir.isRTL
        ? 'لم يتم استلام الدفع. لم يتم تأكيد موعدك بعد.'
        : 'We did not receive your payment. Your appointment is not confirmed yet.',
    },
  };
  const { title: headerTitle, subtitle: paymentStatusCopy } = headerCopy[effectivePhase];
  const phaseColor =
    effectivePhase === 'failed'
      ? colors.accent.coral
      : effectivePhase === 'pending' || effectivePhase === 'polling'
        ? colors.accent.amber
        : colors.teal[500];

  const centeredText = { textAlign: 'center', writingDirection: dir.writingDirection } as const;

  const infoRows: InfoRow[] = [];
  if (therapistName) {
    infoRows.push({ icon: User, label: dir.isRTL ? 'المعالج' : 'Therapist', value: therapistName });
  }
  if (booking?.scheduledAt) {
    infoRows.push({
      icon: Calendar,
      label: dir.isRTL ? 'التاريخ والوقت' : 'Date & time',
      value: formatWhen(booking.scheduledAt, dir.isRTL),
    });
  }
  infoRows.push({
    icon: Hash,
    label: dir.isRTL ? 'رقم الموعد' : 'Booking #',
    value: bookingId ? shortBookingRef(bookingId) : '—',
  });
  if (paymentId) {
    infoRows.push({
      icon: Hash,
      label: dir.isRTL ? 'رقم الدفع' : 'Payment #',
      value: shortBookingRef(paymentId),
    });
  }

  const StatusIcon: LucideIcon = effectivePhase === 'failed' ? CircleAlert : effectivePhase === 'confirmed' ? Check : Clock;
  const isConfirmed = effectivePhase === 'confirmed';

  return (
    <AquaBackground>
      <View style={[styles.container, { paddingTop: insets.top + sawaaSpacing['2xl'], paddingBottom: insets.bottom + 180 }]}>
        <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(600).easing(Easing.out(Easing.cubic))}>
          {isConfirmed ? (
            <LinearGradient colors={[colors.teal[500], colors.teal[700]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconCircle}>
              <StatusIcon size={56} color={colors.teal[50]} strokeWidth={2.5} />
            </LinearGradient>
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: withAlpha(phaseColor, 0.14), borderColor: withAlpha(phaseColor, 0.3), borderWidth: StyleSheet.hairlineWidth }]}>
              <StatusIcon size={56} color={phaseColor} strokeWidth={2.5} />
            </View>
          )}
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(160).duration(600).easing(Easing.out(Easing.cubic))}
          style={styles.textBlock}
        >
          <Text accessibilityRole="header" style={[styles.title, { fontFamily: f700 }, centeredText]}>
            {headerTitle}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, fontWeight: '400' }, centeredText]}>
            {paymentStatusCopy}
          </Text>
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(320).duration(700).easing(Easing.out(Easing.cubic))}
          style={styles.summaryWrap}
        >
          {loading ? (
            <Glass radius={sawaaRadius.lg}>
              <View style={styles.skeletonBlock}>
                <Skeleton height={14} width="40%" />
                <Skeleton height={14} width="70%" />
                <Skeleton height={14} width="55%" />
              </View>
            </Glass>
          ) : (
            <InfoRows rows={infoRows} />
          )}
        </Animated.View>
      </View>

      <FloatingCta>
        {effectivePhase === 'pending' ? (
          <PrimaryButton
            label={dir.isRTL ? 'تحقق مرة أخرى' : 'Check again'}
            onPress={checkPaymentAndBookingAgain}
            fontFamily={f700}
          />
        ) : effectivePhase === 'failed' ? (
          <PrimaryButton
            label={dir.isRTL ? 'إعادة المحاولة' : 'Try again'}
            onPress={retryPayment}
            fontFamily={f700}
          />
        ) : (
          <PrimaryButton
            label={dir.isRTL ? 'عرض مواعيدي' : 'View my appointments'}
            onPress={() => router.replace('/(client)/(tabs)/appointments')}
            fontFamily={f700}
          />
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(client)/(tabs)/home')}
          style={styles.secondaryBtn}
        >
          <Text style={[styles.secondaryBtnText, { fontFamily: f600, fontWeight: '600' }, centeredText]}>
            {t('booking.backToHome')}
          </Text>
        </Pressable>
      </FloatingCta>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: sawaaSpacing['2xl'],
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: sawaaSpacing['2xl'],
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: sawaaRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { alignItems: 'center', gap: sawaaSpacing.sm },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: colors.ink[900],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[500],
    textAlign: 'center',
  },
  summaryWrap: { width: '100%' },
  skeletonBlock: { padding: sawaaSpacing.lg, gap: sawaaSpacing.md },
  secondaryBtn: {
    height: 56,
    borderRadius: sawaaRadius.pill,
    borderWidth: 1.5,
    borderColor: colors.teal[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: sawaaType.body.fontSize + 2,
    color: colors.teal[700],
    textAlign: 'center',
  },
});
