import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { sawaaRadius, sawaaSpacing, sawaaType, getSawaaRoles } from '@/theme/sawaa/tokens';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  enabled: boolean;
  pending: boolean;
  onPress: () => void;
  fontFamily: string;
}

export function PackageBookingAction({ enabled, pending, onPress, fontFamily }: Props) {
  const { scheme } = useTheme();
  const action = getSawaaRoles(scheme).action;
  const styles = React.useMemo(() => createStyles(action), [action]);
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

const createStyles = (action: ReturnType<typeof getSawaaRoles>['action']) => StyleSheet.create({
  cta: { backgroundColor: action.fill, borderRadius: sawaaRadius.md, alignItems: 'center', padding: sawaaSpacing.lg, marginTop: sawaaSpacing.lg },
  disabled: { opacity: 0.5 },
  text: { color: action.foreground, fontSize: sawaaType.body.fontSize },
});
