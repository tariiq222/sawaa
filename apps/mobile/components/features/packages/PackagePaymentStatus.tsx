import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/ui/AppButton';
import { sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import type { PackagePaymentState } from '@/lib/package-utils';

interface Props {
  state: PackagePaymentState;
  error?: boolean;
  onBack: () => void;
  /** Re-reads the purchase status (status error or unconfirmed payment). */
  onRetry?: () => void;
  /** Re-opens checkout for the same purchase (failed or unconfirmed payment). */
  onTryAgain?: () => void;
  tryingAgain?: boolean;
  dir: { textAlign: 'left' | 'right' };
  f400: string;
  f600: string;
  f700: string;
}

const TITLE_KEYS = {
  pending: 'packages.paymentPending',
  success: 'packages.paymentSuccess',
  failed: 'packages.paymentFailed',
  unconfirmed: 'packages.paymentUnconfirmed',
} as const;

const DESCRIPTION_KEYS = {
  pending: 'packages.paymentPendingDescription',
  success: 'packages.paymentSuccessDescription',
  failed: 'packages.paymentFailedDescription',
  unconfirmed: 'packages.paymentUnconfirmedDescription',
} as const;

export function PackagePaymentStatus({ state, error = false, onBack, onRetry, onTryAgain, tryingAgain = false, dir, f400, f700 }: Props) {
  const sawaaColors = useSawaaColors();
  const styles = React.useMemo(() => createStyles(sawaaColors), [sawaaColors]);
  const { t } = useTranslation();
  const pending = state === 'pending';
  const canCheckAgain = Boolean(onRetry) && (error || state === 'unconfirmed');
  const canTryAgain = Boolean(onTryAgain) && !error && (state === 'failed' || state === 'unconfirmed');
  return (
    <View style={styles.content}>
      {pending ? <ActivityIndicator color={sawaaColors.teal[600]} /> : null}
      <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
        {error ? t('packages.paymentError') : t(TITLE_KEYS[state])}
      </Text>
      <Text style={[styles.description, { fontFamily: f400, textAlign: dir.textAlign }]}>
        {error ? t('packages.paymentErrorDescription') : t(DESCRIPTION_KEYS[state])}
      </Text>
      {canTryAgain ? <AppButton label={t('packages.tryPaymentAgain')} onPress={onTryAgain} loading={tryingAgain} /> : null}
      {canCheckAgain ? <AppButton variant="secondary" label={t(error ? 'packages.retry' : 'packages.checkAgain')} onPress={onRetry} /> : null}
      <AppButton variant={canTryAgain ? 'secondary' : 'primary'} label={t('packages.backToBalance')} onPress={onBack} />
      {pending ? <Text style={[styles.note, { fontFamily: f400, textAlign: dir.textAlign }]}>{t('packages.paymentPolling')}</Text> : null}
    </View>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  content: { alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.lg },
  title: { color: sawaaColors.ink[900], fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  description: { color: sawaaColors.ink[500], fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  note: { color: sawaaColors.ink[500], fontSize: sawaaType.caption.fontSize },
});
