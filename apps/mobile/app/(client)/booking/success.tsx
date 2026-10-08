import React, { useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { useDir } from '@/hooks/useDir';
import { useTranslation } from 'react-i18next';
import { formatWeekdayDateTime } from '@/lib/session-format';
import { useReduceMotion } from '@/hooks/useA11y';
import { useBooking, useClientInvoice } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';
import { resolveConfirmedPhase, usePaymentStatus, type PaymentPhase } from '@/features/booking/use-payment-status';

function formatWhen(iso: string, isRTL: boolean): string {
  return formatWeekdayDateTime(iso, isRTL) ?? '—';
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
  const [footerHeight, setFooterHeight] = useState(180);
  const { bookingId, invoiceId, paymentId, webResult, amount, currency } = useLocalSearchParams<{
    bookingId?: string;
    invoiceId?: string;
    paymentId?: string;
    webResult?: string;
    amount?: string;
    currency?: string;
  }>();
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');

  const bookingQuery = useBooking(bookingId);
  const invoiceQuery = useClientInvoice(invoiceId);
  const booking = bookingQuery.data ?? null;
  const loading = Boolean(bookingId) && bookingQuery.isLoading;

  // Payment phase is derived by polling the backend (the source of truth). The
  // WebBrowser result alone is NOT trusted: see use-payment-status for the rules.
  const { phase, checkAgain } = usePaymentStatus(invoiceId, webResult);
  const checkPaymentAndBookingAgain = () => {
    checkAgain();
    if (bookingId) void bookingQuery.refetch();
    if (invoiceId) void invoiceQuery.refetch();
  };

  // A paid invoice does not guarantee the booking itself has been confirmed yet
  // (e.g. settlement lag). Deposit confirmation does not settle the balance.
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
      title: t('booking.confirmingPayment'),
      subtitle: t('booking.checkingPaymentStatus'),
    },
    confirmed: {
      title: t('booking.appointmentConfirmed'),
      subtitle: booking?.status?.toUpperCase() === 'DEPOSIT_PAID'
        ? (t('booking.depositBalanceDue'))
        : invoiceId
        ? (t('booking.paymentReceived'))
        : (t('booking.paymentFollowUp')),
    },
    pending: phase === 'confirmed' ? {
      title: t('booking.confirmingAppointment'),
      subtitle: t('booking.checkingAppointmentStatus'),
    } : {
      title: t('booking.paymentProcessing'),
      subtitle: t('booking.paymentUnconfirmed'),
    },
    failed: {
      title: t('booking.paymentNotCompleted'),
      subtitle: t('booking.paymentNotReceived'),
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
    infoRows.push({ icon: User, label: t('booking.therapist'), value: therapistName });
  }
  if (booking?.scheduledAt) {
    infoRows.push({
      icon: Calendar,
      label: t('booking.dateTime'),
      value: formatWhen(booking.scheduledAt, dir.isRTL),
    });
  }
  infoRows.push({
    icon: Hash,
    label: t('booking.bookingReference'),
    value: bookingId ? shortBookingRef(bookingId) : '—',
  });
  if (invoiceId) {
    const invoice = invoiceQuery.data;
    const number = invoice?.id === invoiceId ? invoice.number : undefined;
    infoRows.push({
      icon: Hash,
      label: t('booking.invoiceNumber'),
      value: typeof number === 'number' && Number.isSafeInteger(number) && number > 0 ? `#${number}` : '—',
    });
  }

  if (paymentId) {
    infoRows.push({
      icon: Hash,
      label: t('booking.paymentReference'),
      value: shortBookingRef(paymentId),
    });
  }

  const StatusIcon: LucideIcon = effectivePhase === 'failed' ? CircleAlert : effectivePhase === 'confirmed' ? Check : Clock;
  const isConfirmed = effectivePhase === 'confirmed';

  return (
    <AquaBackground>
      <ScrollView testID="booking-success-scroll" style={{ flex: 1 }} contentContainerStyle={[styles.container, { paddingTop: insets.top + sawaaSpacing['2xl'], paddingBottom: footerHeight + sawaaSpacing.lg }]} showsVerticalScrollIndicator={false}>
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
            <InfoRows rows={infoRows} layout="stacked" />
          )}
        </Animated.View>
      </ScrollView>

      <FloatingCta onHeightChange={setFooterHeight}>
        {effectivePhase === 'pending' ? (
          <PrimaryButton
            label={t('booking.checkAgain')}
            onPress={checkPaymentAndBookingAgain}
            fontFamily={f700}
          />
        ) : effectivePhase === 'failed' ? (
          <PrimaryButton
            label={t('common.tryAgain')}
            onPress={retryPayment}
            fontFamily={f700}
          />
        ) : (
          <PrimaryButton
            label={t('booking.viewMyAppointments')}
            onPress={() => router.replace('/(client)/(tabs)/appointments')}
            fontFamily={f700}
          />
        )}
        <SecondaryButton label={t('booking.backToHome')} onPress={() => router.replace('/(client)/(tabs)/home')} />
      </FloatingCta>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  container: {
    flexGrow: 1,
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
});
