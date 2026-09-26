import React, { useEffect, useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Apple, Banknote, Check, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AquaBackground, sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { APP_SCHEME } from '@/constants/config';
import { clientBookingsService } from '@/services/client/bookings';
import { clientPaymentsService } from '@/services/client/payments';
import { formatHalalas } from '@/lib/money';
import type { DeliveryType } from '@/types/booking-enums';
import { useBankTransferSettings } from '@/hooks/queries';
import { isClientBankTransferAvailable } from '@/features/booking/payment-methods';
import { useAppSelector } from '@/hooks/use-redux';
import {
  bookingPaymentDraft,
  clearPendingBookingCheckout,
  resolvePendingBookingResume,
  savePendingBookingCheckout,
  type BookingPaymentDraft,
} from '@/features/booking/payment-resume-state';
type Method = 'card' | 'apple_pay' | 'bank_transfer';
export default function BookingPaymentScreen() {
  const colors = useSawaaColors();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(colors, theme.colors), [colors, theme.colors]);
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    serviceId?: string;
    employeeId?: string;
    branchId?: string;
    deliveryType?: DeliveryType;
    scheduledAt?: string;
    durationOptionId?: string;
    amount?: string;
    currency?: string;
    /** Set when this screen is re-entered to resume an existing invoice. */
    bookingId?: string;
    invoiceId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const { data: bankTransferSettings } = useBankTransferSettings();
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');
  const [method, setMethod] = useState<Method>('card');
  const [submitting, setSubmitting] = useState(false);
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const draft = useMemo<BookingPaymentDraft | null>(() => bookingPaymentDraft({ branchId: params.branchId, employeeId: params.employeeId, serviceId: params.serviceId, scheduledAt: params.scheduledAt, durationOptionId: params.durationOptionId, deliveryType: params.deliveryType }), [params.branchId, params.employeeId, params.serviceId, params.scheduledAt, params.durationOptionId, params.deliveryType]);
  const [createdBooking, setCreatedBooking] = useState<{ bookingId: string; invoiceId: string | null } | null>(null);
  const [resumeState, setResumeState] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;
  const total = params.amount ? Number(params.amount) : 0;
  const formatMoney = (halalas: number) =>
    `${formatHalalas(halalas, { locale: dir.isRTL ? 'ar-SA' : 'en-US' })} ⃁`;
  const methods: Array<{ key: Method; icon: React.ReactNode; labelAr: string; labelEn: string; subAr: string; subEn: string; color: string }> = [
    { key: 'card', icon: <CreditCard size={20} color={colors.teal[600]} strokeWidth={1.75} />, labelAr: 'بطاقة ائتمانية', labelEn: 'Credit card', subAr: 'Visa · Mada · Mastercard', subEn: 'Visa · Mada · Mastercard', color: colors.teal[600] },
    { key: 'apple_pay', icon: <Apple size={20} color={colors.teal[600]} strokeWidth={1.75} />, labelAr: 'Apple Pay', labelEn: 'Apple Pay', subAr: 'ادفع بلمسة واحدة', subEn: 'Pay with one touch', color: colors.teal[600] },
    { key: 'bank_transfer', icon: <Banknote size={20} color={colors.teal[600]} strokeWidth={1.75} />, labelAr: 'تحويل بنكي', labelEn: 'Bank transfer', subAr: 'حوّل يدوياً وارفع الإيصال', subEn: 'Transfer and upload receipt', color: colors.teal[600] },
  ];
  const availableMethods = methods.filter(
    (paymentMethod) => paymentMethod.key !== 'bank_transfer' ||
      isClientBankTransferAvailable(bankTransferSettings),
  );
  useEffect(() => {
    let active = true;
    setResumeState('loading');
    setCreatedBooking(null);
    if (!userId || (!draft && !params.bookingId)) { setResumeState('invalid'); return () => { active = false; }; }
    void resolvePendingBookingResume(userId, draft, params.bookingId
      ? { bookingId: params.bookingId, ...(params.invoiceId ? { invoiceId: params.invoiceId } : {}) } : undefined)
      .then((result) => {
        if (!active) return;
        if (result.kind === 'invalid' || (result.kind === 'missing' && !!params.bookingId)) {
          setResumeState('invalid');
        } else if (result.kind === 'missing') {
          setResumeState('ready');
        } else if (result.kind === 'complete') {
          if (result.checkout.draft) void clearPendingBookingCheckout(userId, result.checkout.draft).catch(() => undefined);
          router.replace({ pathname: '/(client)/booking/success', params: {
            bookingId: result.booking.id, ...(result.booking.invoiceId ? { invoiceId: result.booking.invoiceId } : {}),
          } });
        } else if (result.kind === 'ready') {
          setCreatedBooking({ bookingId: result.checkout.bookingId, invoiceId: result.checkout.invoiceId });
          setResumeState('ready');
        }
      })
      .catch(() => { if (active) setResumeState('invalid'); });
    return () => { active = false; };
  }, [draft, params.bookingId, params.invoiceId, router, userId]);
  const canPay =
    resumeState === 'ready' &&
    (!!createdBooking || !!draft) &&
    !submitting;
  const handlePay = async () => {
    if (!canPay) return;
    setSubmitting(true);
    let resumeSafe = Boolean(createdBooking);
    try {
      let booking = createdBooking;
      if (!booking) {
        if (!userId || !draft) throw new Error('Booking details are unavailable');
        try {
          const created = await clientBookingsService.create({
            branchId: params.branchId!,
            employeeId: params.employeeId!,
            serviceId: params.serviceId!,
            scheduledAt: params.scheduledAt!,
            durationOptionId: params.durationOptionId,
            deliveryType: params.deliveryType,
          });
          booking = { bookingId: created.id, invoiceId: created.invoiceId ?? null };
          await savePendingBookingCheckout(userId, draft, booking);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          resumeSafe = true;
        } catch (error) {
          setResumeState('invalid');
          throw error;
        }
        setCreatedBooking(booking);
      }
      if (method === 'bank_transfer') {
        if (!booking.invoiceId) {
          router.replace({
            pathname: '/(client)/booking/success',
            params: { bookingId: booking.bookingId },
          });
          return;
        }
        router.replace({
          pathname: '/(client)/booking/bank-transfer',
          params: {
            invoiceId: booking.invoiceId,
            amount: String(total),
            bookingId: booking.bookingId,
          },
        });
        return;
      }
      if (!booking.invoiceId) {
        router.replace({
          pathname: '/(client)/booking/success',
          params: { bookingId: booking.bookingId },
        });
        return;
      }
      const payment = await clientPaymentsService.initPayment(
        booking.invoiceId,
        method === 'apple_pay' ? 'APPLE_PAY' : 'ONLINE_CARD',
      );
      let webResult: WebBrowser.WebBrowserAuthSessionResult | null = null;
      if (payment.redirectUrl) {
        webResult = await WebBrowser.openAuthSessionAsync(
          payment.redirectUrl,
          `${APP_SCHEME}://booking/payment-callback`,
        );
      }

      router.replace({
        pathname: '/(client)/booking/success',
        params: {
          bookingId: booking.bookingId,
          invoiceId: booking.invoiceId,
          paymentId: payment.paymentId,
          ...(params.amount ? { amount: String(total) } : {}),
          ...(params.currency ? { currency: params.currency } : {}),
          webResult: webResult?.type ?? 'success',
        },
      });
    } catch (err) {
      if (!resumeSafe) setResumeState('invalid');
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (dir.isRTL ? 'تعذّر إكمال الدفع. حاولي مرة أخرى.' : 'Could not continue payment. Try again.');
      Alert.alert(dir.isRTL ? 'خطأ' : 'Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.pill} onPress={() => router.back()} interactive accessibilityLabel={t('a11y.buttonBack')} style={[styles.backBtn, { alignSelf: dir.alignStart }]}>
            <BackIcon size={22} color={colors.ink[700]} strokeWidth={1.75} />
          </Glass>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'اختر طريقة الدفع' : 'Choose payment'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
            {dir.isRTL ? `المبلغ الإجمالي ${formatMoney(total)}` : `Total ${formatMoney(total)}`}
          </Text>
        </Animated.View>

        {availableMethods.map((m, i) => {
          const isSelected = method === m.key;
          return (
            <Animated.View
              key={m.key}
              entering={reduceMotion ? undefined : FadeInDown.delay(160 + i * 80).duration(700).easing(Easing.out(Easing.cubic))}
            >
              <Glass
                variant="strong"
                radius={sawaaRadius.xl}
                onPress={() => {
                  Haptics.selectionAsync();
                  setMethod(m.key);
                }}
                interactive
                style={[
                  styles.methodCard,
                  isSelected && { borderWidth: 2, borderColor: m.color },
                ]}
              >
                <View style={[styles.methodRow, { flexDirection: dir.row }]}>
                  <View style={[styles.methodIcon, { backgroundColor: withAlpha(m.color, 0.12) }]}>{m.icon}</View>
                  <View style={styles.methodMid}>
                    <Text style={[styles.methodLabel, { fontFamily: f700, textAlign: dir.textAlign }]}>
                      {dir.isRTL ? m.labelAr : m.labelEn}
                    </Text>
                    <Text style={[styles.methodSub, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
                      {dir.isRTL ? m.subAr : m.subEn}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: theme.colors.primaryFill }]}>
                      <Check size={14} color={theme.colors.primaryForeground} strokeWidth={3} />
                    </View>
                  )}
                </View>
              </Glass>
            </Animated.View>
          );
        })}
      </ScrollView>

      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.delay(360).duration(700).easing(Easing.out(Easing.cubic))}
        style={[styles.ctaWrap, { bottom: insets.bottom + sawaaSpacing.xl }]}
      >
        <Pressable testID="booking-payment-submit" onPress={handlePay} disabled={!canPay}>
          <LinearGradient
            colors={theme.colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.ctaBtn, !canPay && { opacity: 0.6 }]}
          >
            {submitting ? (
              <ActivityIndicator color={theme.colors.primaryForeground} />
            ) : (
              <>
                <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>
                  {dir.isRTL ? `ادفع ${formatMoney(total)}` : `Pay ${formatMoney(total)}`}
                </Text>
                <GoIcon size={16} color={theme.colors.primaryForeground} strokeWidth={2} />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>, themeColors: ReturnType<typeof useTheme>['theme']['colors']) => StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.md },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: colors.ink[900],
    marginTop: 0,
    paddingHorizontal: sawaaSpacing.xs,
  },
  subtitle: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
    marginTop: 0,
    paddingHorizontal: sawaaSpacing.xs,
  },
  methodCard: { padding: sawaaSpacing.md },
  methodRow: { alignItems: 'center', gap: sawaaSpacing.md },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: sawaaRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodMid: { flex: 1 },
  methodLabel: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
  },
  methodSub: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: colors.ink[500],
    marginTop: sawaaSpacing.xs,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: sawaaRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaWrap: { position: 'absolute', left: sawaaSpacing.lg, right: sawaaSpacing.lg },
  ctaBtn: {
    borderRadius: sawaaRadius.pill,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sawaaSpacing.sm,
    shadowColor: colors.teal[600],
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnText: {
    color: themeColors.primaryForeground,
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
  },
});
