import React from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PrimaryButton, sawaaSpacing } from '@/theme/sawaa';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DeferredApplePayButton } from '@/features/payments/DeferredApplePayButton';
import type { useBookingPayment } from '@/features/booking/use-booking-payment';
import type { useInlineApplePay } from '@/features/booking/use-inline-apple-pay';

export function BookingPaymentActions({ payment, apple }: {
  payment: ReturnType<typeof useBookingPayment>;
  apple: ReturnType<typeof useInlineApplePay>;
}) {
  const { t } = useTranslation();
  const colors = useSawaaColors();
  const dir = useDir();
  const fontFamily = getFontName(dir.locale, '700');
  const hintStyle = { color: colors.ink[500], textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const disabled = !payment.canStart || apple.locked;
  const status = apple.phase === 'processing' ? 'nativePayment.processing'
    : apple.phase === 'pending' || apple.phase === 'checking' ? 'nativePayment.awaitingVerification'
    : apple.phase === 'failed' ? 'nativePayment.failed'
    : apple.phase === 'review' ? 'nativePayment.review'
    : apple.phase === 'unavailable' ? `nativePayment.${apple.unavailableReason ?? 'INVOICE_CLOSED'}`
    : apple.phase === 'error' ? apple.error ?? 'nativePayment.verificationError' : null;
  return <View style={{ gap: sawaaSpacing.sm }}>
    <SectionHeader title={t('booking.paymentMethod')} />
    {payment.methodsLoading ? <Text style={hintStyle}>{t('payment.methodsLoading')}</Text>
      : payment.methodsError ? <EmptyState icon="cloud-offline-outline" tone="danger" title={t('payment.methodsError')}
        actionLabel={t('common.retry')} onAction={payment.retryMethods} />
      : payment.availableMethods.length === 0 ? <EmptyState icon="card-outline" title={t('payment.methodsUnavailable')}
        actionLabel={t('common.retry')} onAction={payment.retryMethods} />
      : <>
        {status ? <Text style={hintStyle}>{t(status)}</Text> : null}
        {payment.submitting || apple.preparing || apple.phase === 'loading' || apple.phase === 'processing' || apple.phase === 'checking'
          ? <ActivityIndicator color={colors.teal[600]} /> : null}
        {payment.availableMethods.includes('apple_pay') ? <DeferredApplePayButton disabled={disabled}
          prepare={apple.prepare} onError={() => { apple.cancel(); Alert.alert(t('common.error'), t('nativePayment.appleUnavailable')); }} /> : null}
        {payment.availableMethods.includes('card') ? <SecondaryButton label={t('nativePayment.useCard')}
          onPress={() => { apple.handoff(); void payment.pay('card'); }} disabled={disabled} fontFamily={fontFamily} /> : null}
        {payment.availableMethods.includes('bank_transfer') ? <SecondaryButton label={t('payment.bankTransfer')}
          onPress={() => { apple.handoff(); void payment.pay('bank_transfer'); }} disabled={disabled} fontFamily={fontFamily} /> : null}
        {payment.availableMethods.includes('at_center') ? <SecondaryButton label={t('booking.confirmAndPayAtCenter')}
          onPress={() => { apple.handoff(); void payment.pay('at_center'); }} disabled={disabled} fontFamily={fontFamily} /> : null}
        {(apple.phase === 'pending' || apple.phase === 'error') && apple.hasPaymentIdentity ? <PrimaryButton label={t('nativePayment.checkAgain')}
          onPress={() => { void apple.reconcile(); }} fontFamily={fontFamily} /> : null}
        {apple.phase === 'error' && apple.canRetryInit ? <SecondaryButton label={t('nativePayment.retry')}
          onPress={() => { void apple.retryInitialization(); }} fontFamily={fontFamily} /> : null}
      </>}
  </View>;
}
