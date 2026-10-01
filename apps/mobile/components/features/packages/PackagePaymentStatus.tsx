import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { sawaaRadius, sawaaSpacing, sawaaType, getSawaaRoles } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/ThemeProvider';
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

export function PackagePaymentStatus({ state, error = false, onBack, onRetry, onTryAgain, tryingAgain = false, dir, f400, f600, f700 }: Props) {
  const sawaaColors = useSawaaColors();
  const { scheme } = useTheme();
  const action = getSawaaRoles(scheme).action;
  const styles = React.useMemo(() => createStyles(sawaaColors, action), [sawaaColors, action]);
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
      {canTryAgain ? (
        <Pressable
          onPress={onTryAgain}
          disabled={tryingAgain}
          style={[styles.cta, tryingAgain && styles.disabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: tryingAgain }}
        >
          <Text style={[styles.ctaText, { fontFamily: f600 }]}>{tryingAgain ? t('packages.purchasing') : t('packages.tryPaymentAgain')}</Text>
        </Pressable>
      ) : null}
      {canCheckAgain ? (
        <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
          <Text style={[styles.retryText, { fontFamily: f600 }]}>{t(error ? 'packages.retry' : 'packages.checkAgain')}</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={onBack} style={canTryAgain ? styles.retry : styles.cta} accessibilityRole="button">
        <Text style={[canTryAgain ? styles.retryText : styles.ctaText, { fontFamily: f600 }]}>{t('packages.backToBalance')}</Text>
      </Pressable>
      {pending ? <Text style={[styles.note, { fontFamily: f400, textAlign: dir.textAlign }]}>{t('packages.paymentPolling')}</Text> : null}
    </View>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>, action: ReturnType<typeof getSawaaRoles>['action']) => StyleSheet.create({
  content: { alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.lg },
  title: { color: sawaaColors.ink[900], fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  description: { color: sawaaColors.ink[500], fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  note: { color: sawaaColors.ink[500], fontSize: sawaaType.caption.fontSize },
  cta: { backgroundColor: action.fill, borderRadius: sawaaRadius.md, paddingHorizontal: sawaaSpacing['2xl'], paddingVertical: sawaaSpacing.lg, marginTop: sawaaSpacing.md },
  ctaText: { color: action.foreground, fontSize: sawaaType.body.fontSize },
  retry: { paddingHorizontal: sawaaSpacing.lg, paddingVertical: sawaaSpacing.sm },
  retryText: { color: sawaaColors.teal[700], fontSize: sawaaType.body.fontSize },
  disabled: { opacity: 0.6 },
});
