import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Apple, Banknote, Check, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { APP_SCHEME } from '@/constants/config';
import { clientBookingsService } from '@/services/client/bookings';
import { clientPaymentsService } from '@/services/client/payments';
import { formatHalalas } from '@/lib/money';
import type { DeliveryType } from '@/types/booking-enums';

type Method = 'card' | 'apple_pay' | 'bank_transfer';

export default function BookingPaymentScreen() {
  const params = useLocalSearchParams<{
    serviceId?: string;
    employeeId?: string;
    branchId?: string;
    deliveryType?: DeliveryType;
    scheduledAt?: string;
    durationOptionId?: string;
    amount?: string;
    currency?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const [method, setMethod] = useState<Method>('card');
  const [submitting, setSubmitting] = useState(false);
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;

  // params.amount is integer halalas (set by confirm.tsx from service.price).
  const total = params.amount ? Number(params.amount) : 0;
  const formatMoney = (halalas: number) =>
    `${formatHalalas(halalas, { locale: dir.isRTL ? 'ar-SA' : 'en-US' })} ⃁`;

  const methods: Array<{ key: Method; icon: React.ReactNode; labelAr: string; labelEn: string; subAr: string; subEn: string; color: string }> = [
    { key: 'card', icon: <CreditCard size={20} color={sawaaColors.teal[600]} strokeWidth={1.75} />, labelAr: 'بطاقة ائتمانية', labelEn: 'Credit card', subAr: 'Visa · Mada · Mastercard', subEn: 'Visa · Mada · Mastercard', color: sawaaColors.teal[600] },
    { key: 'apple_pay', icon: <Apple size={20} color={sawaaColors.ink[900]} strokeWidth={1.75} />, labelAr: 'Apple Pay', labelEn: 'Apple Pay', subAr: 'ادفع بلمسة واحدة', subEn: 'Pay with one touch', color: sawaaColors.ink[900] },
    { key: 'bank_transfer', icon: <Banknote size={20} color={sawaaColors.accent.amber} strokeWidth={1.75} />, labelAr: 'تحويل بنكي', labelEn: 'Bank transfer', subAr: 'حوّل يدوياً وارفع الإيصال', subEn: 'Transfer and upload receipt', color: sawaaColors.accent.amber },
  ];

  const canPay =
    !!params.serviceId &&
    !!params.employeeId &&
    !!params.branchId &&
    !!params.scheduledAt &&
    !submitting;

  const handlePay = async () => {
    if (!canPay) return;
    setSubmitting(true);
    try {
      const booking = await clientBookingsService.create({
        branchId: params.branchId!,
        employeeId: params.employeeId!,
        serviceId: params.serviceId!,
        scheduledAt: params.scheduledAt!,
        durationOptionId: params.durationOptionId,
        deliveryType: params.deliveryType ?? 'in_person',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (method === 'bank_transfer') {
        if (!booking.invoiceId) {
          router.replace({
            pathname: '/(client)/booking/success',
            params: { bookingId: booking.id },
          });
          return;
        }
        router.replace({
          pathname: '/(client)/booking/bank-transfer',
          params: {
            invoiceId: booking.invoiceId,
            amount: String(total),
            bookingId: booking.id,
          },
        });
        return;
      }

      if (!booking.invoiceId) {
        router.replace({
          pathname: '/(client)/booking/success',
          params: { bookingId: booking.id },
        });
        return;
      }

      const payment = await clientPaymentsService.initPayment(
        booking.invoiceId,
        method === 'apple_pay' ? 'APPLE_PAY' : 'ONLINE_CARD',
      );
      if (payment.redirectUrl) {
        await WebBrowser.openAuthSessionAsync(
          payment.redirectUrl,
          `${APP_SCHEME}://booking/payment-callback`,
        );
      }
      router.replace({
        pathname: '/(client)/booking/success',
        params: {
          bookingId: booking.id,
          invoiceId: booking.invoiceId,
          paymentId: payment.paymentId,
        },
      });
    } catch (err) {
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
          <Glass variant="strong" radius={sawaaRadius.pill} onPress={() => router.back()} interactive style={styles.backBtn}>
            <BackIcon size={22} color={sawaaColors.ink[700]} strokeWidth={1.75} />
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

        {methods.map((m, i) => {
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
                    <View style={[styles.checkCircle, { backgroundColor: m.color }]}>
                      <Check size={14} color={sawaaColors.teal[50]} strokeWidth={3} />
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
        <Pressable onPress={handlePay} disabled={!canPay}>
          <LinearGradient
            colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.ctaBtn, !canPay && { opacity: 0.6 }]}
          >
            {submitting ? (
              <ActivityIndicator color={sawaaColors.teal[50]} />
            ) : (
              <>
                <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>
                  {dir.isRTL ? `ادفع ${formatMoney(total)}` : `Pay ${formatMoney(total)}`}
                </Text>
                <GoIcon size={16} color={sawaaColors.teal[50]} strokeWidth={2} />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: sawaaColors.ink[900],
    marginTop: sawaaSpacing.sm,
    paddingHorizontal: sawaaSpacing.xs,
  },
  subtitle: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.ink[500],
    marginTop: sawaaSpacing.xs,
    paddingHorizontal: sawaaSpacing.xs,
  },
  methodCard: { padding: sawaaSpacing.lg },
  methodRow: { alignItems: 'center', gap: sawaaSpacing.lg },
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
    color: sawaaColors.ink[900],
  },
  methodSub: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: sawaaColors.ink[500],
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
    shadowColor: sawaaColors.teal[600],
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnText: {
    color: sawaaColors.teal[50],
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
  },
});
