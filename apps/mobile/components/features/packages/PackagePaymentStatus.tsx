import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { sawaaColors, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import type { PackagePaymentState } from '@/lib/package-utils';

interface Props {
  state: PackagePaymentState;
  error?: boolean;
  onBack: () => void;
  onRetry?: () => void;
  dir: { textAlign: 'left' | 'right' };
  f400: string;
  f600: string;
  f700: string;
}

export function PackagePaymentStatus({ state, error = false, onBack, onRetry, dir, f400, f600, f700 }: Props) {
  const { t } = useTranslation();
  const pending = state === 'pending';
  const success = state === 'success';
  return (
    <View style={styles.content}>
      {pending ? <ActivityIndicator color={sawaaColors.teal[600]} /> : null}
      <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
        {error ? t('packages.paymentError') : pending ? t('packages.paymentPending') : success ? t('packages.paymentSuccess') : t('packages.paymentFailed')}
      </Text>
      <Text style={[styles.description, { fontFamily: f400, textAlign: dir.textAlign }]}>
        {error ? t('packages.paymentErrorDescription') : pending ? t('packages.paymentPendingDescription') : success ? t('packages.paymentSuccessDescription') : t('packages.paymentFailedDescription')}
      </Text>
      {error && onRetry ? (
        <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
          <Text style={[styles.retryText, { fontFamily: f600 }]}>{t('packages.retry')}</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={onBack} style={styles.cta} accessibilityRole="button">
        <Text style={[styles.ctaText, { fontFamily: f600 }]}>{t('packages.backToBalance')}</Text>
      </Pressable>
      {pending ? <Text style={[styles.note, { fontFamily: f400, textAlign: dir.textAlign }]}>{t('packages.paymentPolling')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.lg },
  title: { color: sawaaColors.ink[900], fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  description: { color: sawaaColors.ink[500], fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  note: { color: sawaaColors.ink[500], fontSize: sawaaType.caption.fontSize },
  cta: { backgroundColor: sawaaColors.teal[600], borderRadius: sawaaRadius.md, paddingHorizontal: sawaaSpacing['2xl'], paddingVertical: sawaaSpacing.lg, marginTop: sawaaSpacing.md },
  ctaText: { color: sawaaColors.glass.bgStrong, fontSize: sawaaType.body.fontSize },
  retry: { paddingHorizontal: sawaaSpacing.lg, paddingVertical: sawaaSpacing.sm },
  retryText: { color: sawaaColors.teal[700], fontSize: sawaaType.body.fontSize },
});
