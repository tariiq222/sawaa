import React, { useMemo, useRef, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { APP_SCHEME } from '@/constants/config';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useBranding, useGroupSession } from '@/hooks/queries';
import { clientPaymentsService, type ClientInvoice } from '@/services/client/payments';
import { formatHalalas } from '@/lib/money';
import { AquaBackground, PrimaryButton, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { BackButton } from '@/components/ui/BackButton';
import {
  useExistingBookingCheckout,
  canResumeHostedPayment,
  canStartHostedPayment,
  type ExistingBookingCheckoutPhase,
} from '@/features/booking/use-existing-booking-checkout';

function phaseCopy(phase: ExistingBookingCheckoutPhase, t: (key: string) => string) {
  switch (phase) {
    case 'loading': return { title: t('checkout.title'), body: t('checkout.loading') };
    case 'success': return { title: t('checkout.success'), body: t('checkout.successDescription') };
    case 'pending': return { title: t('checkout.pending'), body: t('checkout.pendingDescription') };
    case 'failed': return { title: t('checkout.failed'), body: t('checkout.failedDescription') };
    case 'cancelled': return { title: t('checkout.cancelled'), body: t('checkout.failedDescription') };
    case 'expired': return { title: t('checkout.expired'), body: t('checkout.failedDescription') };
    case 'missing_invoice': return { title: t('checkout.missingInvoice'), body: t('checkout.missingInvoice') };
    case 'invoice_mismatch': return { title: t('checkout.invoiceMismatch'), body: t('checkout.invoiceMismatch') };
    case 'error': return { title: t('checkout.loadError'), body: t('checkout.loadError') };
    default: return { title: t('checkout.title'), body: t('checkout.continue') };
  }
}

function validAmount(value: number | string | undefined): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function remainingHalalas(invoice: ClientInvoice | null): number | null {
  if (!invoice || !Array.isArray(invoice.payments)) return null;
  const rawTotal = validAmount(invoice.total);
  if (rawTotal === null || !Number.isSafeInteger(Math.round(rawTotal))) return null;
  const total = Math.round(rawTotal);
  let completed = 0;
  for (const payment of invoice.payments) {
    if (payment.status !== 'COMPLETED') continue;
    const amount = validAmount(payment.amount);
    if (amount === null || !Number.isSafeInteger(amount)) return null;
    completed += amount;
    if (!Number.isSafeInteger(completed)) return null;
  }
  return Math.max(0, total - completed);
}

export default function ExistingBookingCheckoutScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { bookingId, invoiceId, programId } = useLocalSearchParams<{
    bookingId?: string;
    invoiceId?: string;
    programId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');
  const brandingQuery = useBranding();
  const programQuery = useGroupSession(programId);
  const checkout = useExistingBookingCheckout({ bookingId, invoiceId });
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const copy = phaseCopy(checkout.phase, t);
  const amount = remainingHalalas(checkout.invoice);
  const currency = checkout.invoice?.currency ?? 'SAR';
  const amountText = amount !== null
    ? t('checkout.currency', {
        amount: formatHalalas(amount, { locale: dir.isRTL ? 'ar-SA' : 'en-US' }),
        currency,
      })
    : t('checkout.amountUnavailable');
  const canPay = Boolean(checkout.invoice?.id) && canStartHostedPayment(checkout.invoice) && !submitting && (
    ['ready', 'failed'].includes(checkout.phase) ||
    (checkout.phase === 'pending' && canResumeHostedPayment(checkout.invoice))
  );

  const openPayment = async () => {
    if (!canPay || !checkout.invoice?.id) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const payment = await clientPaymentsService.initPayment(checkout.invoice.id, 'ONLINE_CARD');
      if (payment.redirectUrl) {
        await WebBrowser.openAuthSessionAsync(
          payment.redirectUrl,
          `${APP_SCHEME}://booking/payment-callback`,
        );
      }
      checkout.checkAgain();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('checkout.loadError');
      Alert.alert(t('groups.title'), message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const showPaymentChoice = canPay && checkout.invoice;
  const showRetry = checkout.phase === 'pending' || checkout.phase === 'error';
  const showContact = Boolean(brandingQuery.data?.contactPhone) &&
    ['error', 'missing_invoice', 'invoice_mismatch', 'cancelled', 'expired'].includes(checkout.phase);

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.lg, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <BackButton onPress={() => router.back()} style={{ alignSelf: dir.alignStart }} />

        <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
          {copy.title}
        </Text>
        <Text style={[styles.body, { fontFamily: f400, textAlign: dir.textAlign }]}>
          {copy.body}
        </Text>

        {checkout.isRefreshing && !checkout.booking ? <ActivityIndicator color={colors.teal[600]} /> : null}

        <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
          <Text style={[styles.label, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {t('checkout.program')}
          </Text>
          <Text style={[styles.value, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {programQuery.data?.title ?? t('groups.title')}
          </Text>
          {checkout.booking?.branchName || checkout.booking?.branchNameAr ? (
            <Text style={[styles.label, { fontFamily: f400, textAlign: dir.textAlign }]}>
              {dir.isRTL ? checkout.booking.branchNameAr ?? checkout.booking.branchName : checkout.booking.branchName ?? checkout.booking.branchNameAr}
            </Text>
          ) : null}
          {checkout.invoice ? (
            <View style={styles.amountBlock}>
              <Text style={[styles.label, { fontFamily: f400, textAlign: dir.textAlign }]}>
                {t('checkout.remainingAmount')}
              </Text>
              <Text style={[styles.amount, { fontFamily: f700, textAlign: dir.textAlign }]}>
                {amountText}
              </Text>
            </View>
          ) : null}
        </Glass>

        {showPaymentChoice ? (
          <Text style={[styles.body, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {t('checkout.paymentMethods')}
          </Text>
        ) : null}
        {showPaymentChoice ? (
          <PrimaryButton
            label={submitting ? t('checkout.processing') : t('checkout.continue')}
            onPress={openPayment}
            disabled={!canPay}
            fontFamily={f700}
          />
        ) : null}
        {showRetry ? (
          <PrimaryButton
            label={t('checkout.retry')}
            onPress={checkout.checkAgain}
            disabled={checkout.isRefreshing}
            fontFamily={f700}
          />
        ) : null}
        {checkout.phase === 'success' ? (
          <PrimaryButton
            label={t('checkout.appointments')}
            onPress={() => router.replace('/(client)/(tabs)/appointments')}
            fontFamily={f700}
          />
        ) : null}
        {showContact ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`tel:${brandingQuery.data?.contactPhone}`)}
          >
            <Text style={[styles.contact, { fontFamily: f700, textAlign: 'center' }]}>
              {t('checkout.contactCenter')} · {brandingQuery.data?.contactPhone}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  title: { color: colors.ink[900], fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  body: { color: colors.ink[500], fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  card: { padding: sawaaSpacing.lg, gap: sawaaSpacing.xs },
  label: { color: colors.ink[500], fontSize: sawaaType.micro.fontSize, lineHeight: sawaaType.micro.lineHeight },
  value: { color: colors.ink[900], fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  amountBlock: { marginTop: sawaaSpacing.md, gap: sawaaSpacing.xs },
  amount: { color: colors.teal[700], fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  contact: { color: colors.teal[700], fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight },
});
