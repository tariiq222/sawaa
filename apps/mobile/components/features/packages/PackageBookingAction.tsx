import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { sawaaColors, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';

interface Props {
  enabled: boolean;
  pending: boolean;
  onPress: () => void;
  fontFamily: string;
}

export function PackageBookingAction({ enabled, pending, onPress, fontFamily }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled || pending}
      style={[styles.cta, (!enabled || pending) && styles.disabled]}
      accessibilityRole="button"
    >
      <Text style={[styles.text, { fontFamily }]}>{pending ? t('packages.booking') : t('packages.confirmBooking')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cta: { backgroundColor: sawaaColors.teal[600], borderRadius: sawaaRadius.md, alignItems: 'center', padding: sawaaSpacing.lg, marginTop: sawaaSpacing.lg },
  disabled: { opacity: 0.5 },
  text: { color: sawaaColors.glass.bgStrong, fontSize: sawaaType.body.fontSize },
});
