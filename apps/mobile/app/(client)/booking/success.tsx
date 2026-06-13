import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';

import {
  AquaBackground,
  sawaaColors,
  sawaaRadius,
  sawaaSemantic,
  sawaaSpacing,
  sawaaType,
  withAlpha,
} from '@/theme/sawaa';
import { GlassSurface } from '@/theme/sawaa/GlassSurface';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { clientBookingsService, type ClientBookingRow } from '@/services/client/bookings';
import { clientPaymentsService, type ClientInvoice } from '@/services/client/payments';

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const { bookingId, invoiceId, paymentId } = useLocalSearchParams<{
    bookingId?: string;
    invoiceId?: string;
    paymentId?: string;
  }>();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const [booking, setBooking] = useState<ClientBookingRow | null>(null);
  const [loading, setLoading] = useState(!!bookingId);
  const [invoice, setInvoice] = useState<ClientInvoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(!!invoiceId);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await clientBookingsService.getById(bookingId);
        if (!cancelled) setBooking(data);
      } catch {
        // Booking was created (we have an id) but fetch failed — fall back
        // to a minimal display rather than blocking the success screen.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  useEffect(() => {
    if (!invoiceId) {
      setInvoice(null);
      setInvoiceLoading(false);
      return;
    }
    let cancelled = false;
    setInvoiceLoading(true);
    (async () => {
      try {
        const data = await clientPaymentsService.getInvoice(invoiceId);
        if (!cancelled) setInvoice(data);
      } catch {
        if (!cancelled) setInvoice(null);
      } finally {
        if (!cancelled) setInvoiceLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [invoiceId]);

  const therapistName = booking?.employee
    ? (dir.isRTL ? booking.employee.nameAr : booking.employee.nameEn) ?? booking.employee.nameAr ?? booking.employee.nameEn
    : null;
  const fallbackPaymentCopy = dir.isRTL
    ? 'سنتواصل معكِ قريباً لترتيب الدفع وإرسال تفاصيل الجلسة'
    : 'We\'ll reach out shortly to arrange payment and send session details';
  const hasPendingPayment = invoice?.payments?.some((payment) =>
    payment.status === 'PENDING' || payment.status === 'PENDING_VERIFICATION',
  ) ?? false;
  const paymentStatusCopy = invoiceLoading
    ? (dir.isRTL ? 'جاري تحديث حالة الدفع...' : 'Checking payment status...')
    : invoice?.status === 'PAID'
      ? (dir.isRTL ? 'تم استلام الدفع' : 'Payment received')
      : invoice?.status === 'PENDING' || hasPendingPayment
        ? (dir.isRTL ? 'بانتظار التحقق من الدفع' : 'Awaiting payment verification')
        : fallbackPaymentCopy;

  const centeredText = { textAlign: 'center', writingDirection: dir.writingDirection } as const;
  const startText = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;

  const summaryRows: Array<{ key: string; labelAr: string; labelEn: string; value: string; accent?: boolean }> = [];
  if (therapistName) {
    summaryRows.push({ key: 'therapist', labelAr: 'المعالج', labelEn: 'Therapist', value: therapistName });
  }
  if (booking?.scheduledAt) {
    summaryRows.push({
      key: 'when',
      labelAr: 'التاريخ والوقت',
      labelEn: 'Date & time',
      value: formatWhen(booking.scheduledAt, dir.isRTL),
    });
  }
  summaryRows.push({
    key: 'ref',
    labelAr: 'رقم الموعد',
    labelEn: 'Booking #',
    value: bookingId ? shortBookingRef(bookingId) : '—',
    accent: true,
  });
  if (paymentId) {
    summaryRows.push({
      key: 'payment',
      labelAr: 'رقم الدفع',
      labelEn: 'Payment #',
      value: shortBookingRef(paymentId),
    });
  }

  return (
    <AquaBackground>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(600).easing(Easing.out(Easing.cubic))}>
          <View style={styles.iconCircle}>
            <Check size={56} color={sawaaSemantic.success} strokeWidth={2.5} />
          </View>
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(160).duration(600).easing(Easing.out(Easing.cubic))}
          style={styles.textBlock}
        >
          <Text style={[styles.title, { fontFamily: f700 }, centeredText]}>
            {dir.isRTL ? 'تم تأكيد موعدك' : 'Appointment confirmed'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, fontWeight: '400' }, centeredText]}>
            {paymentStatusCopy}
          </Text>
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(320).duration(700).easing(Easing.out(Easing.cubic))}
          style={styles.summaryWrap}
        >
          <GlassSurface variant="strong" radius={sawaaRadius.xl}>
            {loading ? (
              <View style={styles.skeletonBlock}>
                <Skeleton height={14} width="40%" />
                <Skeleton height={14} width="70%" />
                <Skeleton height={14} width="55%" />
              </View>
            ) : (
              summaryRows.map((row, i) => (
                <View key={row.key}>
                  {i > 0 ? <View style={styles.divider} /> : null}
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { fontFamily: f400, fontWeight: '400' }, startText]}>
                      {dir.isRTL ? row.labelAr : row.labelEn}
                    </Text>
                    <Text
                      style={[
                        styles.summaryValue,
                        { fontFamily: f700 },
                        row.accent && { color: sawaaColors.teal[700] },
                        startText,
                      ]}
                    >
                      {row.value}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </GlassSurface>
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(480).duration(700).easing(Easing.out(Easing.cubic))}
          style={styles.actions}
        >
          <PrimaryButton
            label={dir.isRTL ? 'عرض مواعيدي' : 'View my appointments'}
            onPress={() => router.replace('/(client)/(tabs)/appointments')}
            fontFamily={f700}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(client)/(tabs)/home')}
          >
            <GlassSurface variant="base" radius={sawaaRadius.pill}>
              <View style={styles.secondaryInner}>
                <Text style={[styles.secondaryBtnText, { fontFamily: f600, fontWeight: '600' }, centeredText]}>
                  {dir.isRTL ? 'العودة إلى الرئيسية' : 'Back to home'}
                </Text>
              </View>
            </GlassSurface>
          </Pressable>
        </Animated.View>
      </View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: sawaaSpacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: sawaaSpacing['2xl'],
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: sawaaRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(sawaaSemantic.success, 0.14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(sawaaSemantic.success, 0.3),
  },
  textBlock: { alignItems: 'center', gap: sawaaSpacing.sm },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: sawaaColors.ink[900],
  },
  subtitle: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.ink[500],
  },
  summaryWrap: { width: '100%' },
  summaryRow: { padding: sawaaSpacing.lg, gap: sawaaSpacing.xs },
  summaryLabel: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: sawaaColors.ink[500],
  },
  summaryValue: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.ink[900],
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(sawaaColors.ink[900], 0.06),
    marginHorizontal: sawaaSpacing.lg,
  },
  skeletonBlock: { padding: sawaaSpacing.lg, gap: sawaaSpacing.md },
  actions: { width: '100%', gap: sawaaSpacing.md },
  secondaryInner: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sawaaSpacing.lg,
  },
  secondaryBtnText: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.teal[700],
  },
});
