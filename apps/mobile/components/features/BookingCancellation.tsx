import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarX2, Check, Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { uuid } from 'expo-modules-core';
import { useBookingCancellationPreview, useCancelBooking } from '@/hooks/queries';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa/tokens';
import { Glass } from '@/theme/components/Glass';
import { useTheme } from '@/theme/useTheme';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import type { CancellationRefund, PersistedCancellationRefund } from '@/services/client/bookings';

type Refund = CancellationRefund | PersistedCancellationRefund;

function RefundSummary({ refund, preview = false }: { refund: Refund; preview?: boolean }) {
  const { t } = useTranslation();
  const colors = useSawaaColors();
  const dir = useDir();
  const style = { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign };
  const key = preview && refund.status === 'CREDIT_RETURNED' ? 'creditPreview'
    : preview && refund.execution === 'AUTOMATIC' ? 'automaticPreview'
    : preview && refund.execution === 'REVIEW' ? 'reviewPreview' : refund.status;
  const amounts: [string, number][] = [
    ['amount', refund.refundAmount], ['alreadyAmount', refund.alreadyRefundedAmount], ['pendingAmount', refund.pendingRefundAmount],
    ...('completedAmount' in refund ? [['completedAmount', refund.completedAmount], ['failedAmount', refund.failedAmount]] as [string, number][] : []),
  ];
  return <View accessibilityLiveRegion="polite" style={styles.refund}>
    <Text style={[styles.body, style]}>{t(`cancellation.${key}`)}</Text>
    {refund.status !== 'CREDIT_RETURNED' && amounts.map(([label, amount]) => amount > 0 &&
      <View key={label} style={[styles.amount, { backgroundColor: colors.teal[50] }]}>
        <Text style={[styles.caption, style]}>{t(`cancellation.${label}`)}</Text>
        <Text style={[styles.amountValue, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '600'), textAlign: dir.textAlign }]}>
          {(amount / 100).toFixed(2)} {refund.currency}{preview && label === 'amount' ? ` (${refund.refundPercent}%)` : ''}
        </Text>
      </View>)}
  </View>;
}

export function BookingCancellation({ bookingId, canCancel, persistedRefund }: {
  bookingId: string; canCancel: boolean; persistedRefund?: PersistedCancellationRefund;
}) {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [outcome, setOutcome] = useState<{ status: string; refund?: CancellationRefund }>();
  const actionId = useRef<string | undefined>(undefined);
  const quote = useBookingCancellationPreview(bookingId, open && !outcome);
  const mutation = useCancelBooking();
  const busy = mutation.isPending || quote.isFetching;
  const textStyle = { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign };
  const eligible = quote.data && quote.data.canCancel;
  const refund = persistedRefund ?? outcome?.refund;
  const button = (label: string, onPress: () => void, disabled = false, filled = false, loading = false) => (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: loading }}
      disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, {
        borderColor: filled ? theme.colors.error : withAlpha(theme.colors.error, 0.3),
        backgroundColor: filled ? theme.colors.error : 'transparent',
        opacity: disabled ? 0.55 : pressed ? 0.8 : 1,
      }]}>
      <View style={[styles.buttonContent, { flexDirection: dir.row }]}>
        {loading && <ActivityIndicator size="small" color={filled ? theme.colors.surface : theme.colors.error} />}
        <Text style={[styles.buttonLabel, { color: filled ? theme.colors.surface : theme.colors.error, fontFamily: getFontName(dir.locale, '600') }]}>{t(label)}</Text>
      </View>
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
  if (canCancel && !refund && !outcome && !open) {
    return button('appointments.cancelAppointment', () => setOpen(true));
  }
  return <Glass variant="base" radius={sawaaRadius.xl} style={styles.card}>
    <View style={[styles.header, { flexDirection: dir.row }]}>
      <View style={[styles.iconBox, { backgroundColor: withAlpha(open ? theme.colors.error : colors.teal[700], 0.1) }]}>
        {open ? <CalendarX2 size={22} color={theme.colors.error} strokeWidth={1.75} />
          : outcome ? <Check size={22} color={colors.teal[700]} strokeWidth={1.75} />
          : <Info size={22} color={colors.teal[700]} strokeWidth={1.75} />}
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}>
        {t(open ? 'appointments.cancelAppointment' : outcome ? 'cancellation.result' : 'cancellation.refundDetails')}
      </Text>
    </View>
    {outcome && <Text accessibilityLiveRegion="polite" style={[styles.body, textStyle]}>{t(outcome.status === 'cancel_requested' ? 'appointments.cancellationRequestedMessage' : 'cancellation.cancelled')}</Text>}
    {refund && <RefundSummary refund={refund} />}
    {canCancel && !outcome && !open && button('appointments.cancelAppointment', () => setOpen(true))}
    {open && !outcome && <View style={styles.content}>
      {(quote.isLoading || quote.isFetching) && <View style={[styles.loading, { flexDirection: dir.row }]}>
        <ActivityIndicator size="small" color={colors.teal[700]} />
        <Text accessibilityLiveRegion="polite" style={[styles.body, styles.flexText, textStyle]}>{t('cancellation.loading')}</Text>
      </View>}
      {quote.isError ? <>
        <Text accessibilityLiveRegion="polite" style={[styles.body, textStyle, { color: theme.colors.error }]}>{t('cancellation.loadError')}</Text>
        {button('cancellation.retry', () => { void quote.refetch(); }, !!busy)}
      </> : quote.data && <>
        <Text style={[styles.body, textStyle]}>{t(`cancellation.${quote.data.reasonCode}`)}</Text>
        {quote.data.policyEnabled && quote.data.cutoffAt && <View style={[styles.amount, { backgroundColor: colors.teal[50] }]}>
          <Text style={[styles.caption, textStyle]}>{t('cancellation.cutoff')}</Text>
          <Text style={[styles.body, textStyle, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '500') }]}>{new Date(quote.data.cutoffAt).toLocaleString(dir.locale, { timeZone: 'Asia/Riyadh' })}</Text>
        </View>}
        {quote.data.canCancel && (quote.data.refundDecision === 'AFTER_APPROVAL'
          ? <Text style={[styles.body, textStyle]}>{t('cancellation.approvalPreview')}</Text>
          : <RefundSummary refund={quote.data.refund} preview />)}
      </>}
      {error && <Text accessibilityRole="alert" style={[styles.body, textStyle, { color: theme.colors.error }]}>{error}</Text>}
      <View style={styles.actions}>
        {!quote.isError && eligible && button('cancellation.confirm', () => { void confirm(); }, !!busy, true, mutation.isPending)}
        <SecondaryButton label={t('cancellation.keepAppointment')} onPress={() => setOpen(false)} disabled={mutation.isPending} />
      </View>
    </View>}
  </Glass>;
}

const styles = StyleSheet.create({
  card: { gap: sawaaSpacing.lg, padding: sawaaSpacing.xl },
  content: { gap: sawaaSpacing.lg },
  refund: { gap: sawaaSpacing.md },
  header: { alignItems: 'center', gap: sawaaSpacing.md },
  iconBox: { width: 44, height: 44, borderRadius: sawaaRadius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { flex: 1, fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  body: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  caption: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight },
  amount: { padding: sawaaSpacing.md, borderRadius: sawaaRadius.sm, gap: sawaaSpacing.xs },
  amountValue: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  actions: { gap: sawaaSpacing.md, paddingTop: sawaaSpacing.xs },
  loading: { alignItems: 'center', gap: sawaaSpacing.md },
  flexText: { flex: 1 },
  button: { minHeight: 56, justifyContent: 'center', padding: sawaaSpacing.lg, borderWidth: 1.5, borderRadius: sawaaRadius.pill },
  buttonContent: { alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.sm },
  buttonLabel: { fontSize: 17, lineHeight: sawaaType.subheading.lineHeight, textAlign: 'center', flexShrink: 1 },
});
