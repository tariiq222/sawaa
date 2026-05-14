import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
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

  return (
    <AquaBackground>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View entering={ZoomIn.duration(900).easing(Easing.bezier(0.22, 1, 0.36, 1))}>
          <LinearGradient
            colors={[sawaaColors.teal[400], sawaaColors.teal[600]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            <Check size={56} color="#fff" strokeWidth={3} />
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(700).easing(Easing.out(Easing.cubic))} style={styles.textBlock}>
          <Text style={[styles.title, { fontFamily: f700 }]}>
            {dir.isRTL ? 'تم تأكيد حجزك' : 'Booking confirmed'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400 }]}>
            {paymentStatusCopy}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(400).duration(800).easing(Easing.out(Easing.cubic))}
          style={styles.summaryWrap}
        >
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.summaryCard}>
            {loading ? (
              <View style={styles.statusBlock}>
                <ActivityIndicator color={sawaaColors.teal[600]} />
              </View>
            ) : (
              <>
                {therapistName ? (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { fontFamily: f400 }]}>
                        {dir.isRTL ? 'المعالج' : 'Therapist'}
                      </Text>
                      <Text style={[styles.summaryValue, { fontFamily: f700 }]}>{therapistName}</Text>
                    </View>
                    <View style={styles.divider} />
                  </>
                ) : null}
                {booking?.scheduledAt ? (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { fontFamily: f400 }]}>
                        {dir.isRTL ? 'التاريخ والوقت' : 'Date & time'}
                      </Text>
                      <Text style={[styles.summaryValue, { fontFamily: f700 }]}>
                        {formatWhen(booking.scheduledAt, dir.isRTL)}
                      </Text>
                    </View>
                    <View style={styles.divider} />
                  </>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { fontFamily: f400 }]}>
                    {dir.isRTL ? 'رقم الحجز' : 'Booking #'}
                  </Text>
                  <Text style={[styles.summaryValue, { fontFamily: f700, color: sawaaColors.teal[700] }]}>
                    {bookingId ? shortBookingRef(bookingId) : '—'}
                  </Text>
                </View>
                {paymentId ? (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { fontFamily: f400 }]}>
                        {dir.isRTL ? 'رقم الدفع' : 'Payment #'}
                      </Text>
                      <Text style={[styles.summaryValue, { fontFamily: f700 }]}>
                        {shortBookingRef(paymentId)}
                      </Text>
                    </View>
                  </>
                ) : null}
              </>
            )}
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(800).easing(Easing.out(Easing.cubic))} style={styles.actions}>
          <Pressable onPress={() => router.replace('/(client)/(tabs)/appointments')}>
            <LinearGradient
              colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              <Text style={[styles.primaryBtnText, { fontFamily: f700 }]}>
                {dir.isRTL ? 'عرض مواعيدي' : 'View my appointments'}
              </Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(client)/(tabs)/home')}
            style={styles.secondaryBtn}
          >
            <Text style={[styles.secondaryBtnText, { fontFamily: f600 }]}>
              {dir.isRTL ? 'العودة إلى الرئيسية' : 'Back to home'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', gap: 24 },
  iconCircle: {
    width: 112, height: 112, borderRadius: 56,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
  },
  textBlock: { alignItems: 'center', gap: 6 },
  title: { fontSize: 26, color: sawaaColors.ink[900], textAlign: 'center' },
  subtitle: { fontSize: 14, color: sawaaColors.ink[500], textAlign: 'center', lineHeight: 22 },
  summaryWrap: { width: '100%' },
  summaryCard: { padding: 0 },
  summaryRow: { padding: 14, gap: 2 },
  summaryLabel: { fontSize: 11.5, color: sawaaColors.ink[500] },
  summaryValue: { fontSize: 13.5, color: sawaaColors.ink[900] },
  divider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.5)' },
  statusBlock: { paddingVertical: 32, alignItems: 'center', justifyContent: 'center' },
  actions: { width: '100%', gap: 10 },
  primaryBtn: {
    borderRadius: 999, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  primaryBtnText: { color: '#fff', fontSize: 14 },
  secondaryBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: sawaaColors.teal[700], fontSize: 13 },
});
