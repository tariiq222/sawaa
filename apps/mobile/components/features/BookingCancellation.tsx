import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { uuid } from 'expo-modules-core';
import { useBookingCancellationPreview, useCancelBooking } from '@/hooks/queries';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius, sawaaSpacing } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import type { CancellationRefund, PersistedCancellationRefund } from '@/services/client/bookings';

type Refund = CancellationRefund | PersistedCancellationRefund;

function RefundSummary({ refund, preview = false }: { refund: Refund; preview?: boolean }) {
  const { t } = useTranslation();
  const colors = useSawaaColors();
  const dir = useDir();
  const style = { color: colors.ink[900], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign };
  const key = preview && refund.status === 'CREDIT_RETURNED' ? 'creditPreview'
    : preview && refund.execution === 'AUTOMATIC' ? 'automaticPreview'
    : preview && refund.execution === 'REVIEW' ? 'reviewPreview' : refund.status;
  const amounts: [string, number][] = [
    ['amount', refund.refundAmount], ['alreadyAmount', refund.alreadyRefundedAmount], ['pendingAmount', refund.pendingRefundAmount],
    ...('completedAmount' in refund ? [['completedAmount', refund.completedAmount], ['failedAmount', refund.failedAmount]] as [string, number][] : []),
  ];
  return <View accessibilityLiveRegion="polite" style={styles.content}>
    <Text style={style}>{t(`cancellation.${key}`)}</Text>
    {refund.status !== 'CREDIT_RETURNED' && amounts.map(([label, amount]) => amount > 0 &&
      <Text key={label} style={style}>{t(`cancellation.${label}`)}: {(amount / 100).toFixed(2)} {refund.currency}{preview && label === 'amount' ? ` (${refund.refundPercent}%)` : ''}</Text>)}
  </View>;
}

export function BookingCancellation({ bookingId, canCancel, persistedRefund }: {
  bookingId: string; canCancel: boolean; persistedRefund?: PersistedCancellationRefund;
}) {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [outcome, setOutcome] = useState<{ status: string; refund?: CancellationRefund }>();
  const actionId = useRef<string | undefined>(undefined);
  const quote = useBookingCancellationPreview(bookingId, open && !outcome);
  const mutation = useCancelBooking();
  const busy = mutation.isPending || quote.isFetching;
  const textStyle = { color: colors.ink[900], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign };
  const eligible = quote.data && quote.data.canCancel;
  const refund = persistedRefund ?? outcome?.refund;
  const button = (label: string, onPress: () => void, disabled = false) => (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: disabled && busy }}
      disabled={disabled} onPress={onPress} style={[styles.button, { borderColor: colors.ink[400], opacity: disabled ? 0.5 : 1 }]}>
      <Text style={textStyle}>{t(label)}</Text>
    </Pressable>
  );
  const confirm = async () => {
    if (!eligible || busy || quote.isError) return;
    setError(undefined);
    if (!actionId.current) actionId.current = uuid.v4();
    try {
      const result = await mutation.mutateAsync({ id: bookingId, reason: t('appointments.cancelReason'),
        acceptedRefundTerms: true, quoteToken: quote.data.quoteToken, sourceActionId: actionId.current,
      });
      setOutcome({ status: result.status, refund: result.refund });
      setOpen(false);
    } catch (err) {
      const status = (err as { response?: { status?: number }; status?: number }).response?.status ?? (err as { status?: number }).status;
      if (status === 409) {
        setError(t('cancellation.changed'));
        actionId.current = undefined;
        await quote.refetch();
      } else setError(t('appointments.cancelFailed'));
    }
  };
  if (!canCancel && !refund && !outcome) return null;
  return <Glass variant="base" radius={sawaaRadius.lg} style={styles.content}>
    {outcome && <Text accessibilityLiveRegion="polite" style={textStyle}>{t(outcome.status === 'cancel_requested' ? 'appointments.cancellationRequestedMessage' : 'cancellation.cancelled')}</Text>}
    {refund && <RefundSummary refund={refund} />}
    {canCancel && !outcome && !open && button('appointments.cancelAppointment', () => setOpen(true))}
    {open && !outcome && <View style={styles.content}>
      {(quote.isLoading || quote.isFetching) && <Text style={textStyle}>{t('cancellation.loading')}</Text>}
      {quote.isError ? <>
        <Text accessibilityLiveRegion="polite" style={textStyle}>{t('cancellation.loadError')}</Text>
        {button('cancellation.retry', () => { void quote.refetch(); }, !!busy)}
      </> : quote.data && <>
        <Text style={textStyle}>{t(`cancellation.${quote.data.reasonCode}`)}</Text>
        {quote.data.policyEnabled && quote.data.cutoffAt && <Text style={textStyle}>{t('cancellation.cutoff')}: {new Date(quote.data.cutoffAt).toLocaleString(dir.locale, { timeZone: 'Asia/Riyadh' })}</Text>}
        {quote.data.canCancel && (quote.data.refundDecision === 'AFTER_APPROVAL'
          ? <Text style={textStyle}>{t('cancellation.approvalPreview')}</Text>
          : <RefundSummary refund={quote.data.refund} preview />)}
        {eligible && button('cancellation.confirm', () => { void confirm(); }, !!busy)}
      </>}
      {error && <Text accessibilityRole="alert" style={textStyle}>{error}</Text>}
      {button('common.back', () => setOpen(false), mutation.isPending)}
    </View>}
  </Glass>;
}

const styles = StyleSheet.create({
  content: { gap: sawaaSpacing.md, padding: sawaaSpacing.md },
  button: { minHeight: 48, justifyContent: 'center', padding: sawaaSpacing.md, borderWidth: 1, borderRadius: sawaaRadius.md },
});
