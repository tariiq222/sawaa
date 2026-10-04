import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ClientPackageCredit } from '@sawaa/shared/types';

import type { DirState } from '@/hooks/useDir';
import { sawaaRadius, sawaaSpacing, sawaaType, getSawaaRoles } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/ThemeProvider';
import { creditLockReason, isCreditBookable } from '@/lib/package-utils';

interface Props {
  credit: ClientPackageCredit;
  dir: DirState;
  f400: string;
  f600: string;
  f700: string;
  onBook: (credit: ClientPackageCredit) => void;
}

export function PackageCreditCard({ credit, dir, f400, f600, f700, onBook }: Props) {
  const sawaaColors = useSawaaColors();
  const { scheme } = useTheme();
  const action = getSawaaRoles(scheme).action;
  const styles = React.useMemo(() => createStyles(sawaaColors, action), [sawaaColors, action]);
  const { t } = useTranslation();
  const bookable = isCreditBookable(credit);
  const reason = creditLockReason(credit);
  const concrete = Boolean(credit.serviceId && credit.employeeId && credit.durationOptionId);
  const canBook = bookable && concrete;
  return (
    <View style={styles.credit}>
      <View style={[styles.creditHeader, { flexDirection: dir.row }]}>
        <Text style={[styles.creditName, { fontFamily: f600, textAlign: dir.textAlign }]}>{dir.isRTL ? credit.serviceNameAr : credit.serviceNameEn ?? credit.serviceNameAr}</Text>
        <Text style={[styles.remaining, { fontFamily: f700 }]}>{t('packages.remaining', { count: credit.remaining })}</Text>
      </View>
      <Text style={[styles.duration, { fontFamily: f400, textAlign: dir.textAlign }]}>{dir.isRTL ? credit.durationLabelAr : credit.durationLabelEn ?? credit.durationLabelAr}</Text>
      {canBook ? (
        <Pressable onPress={() => onBook(credit)} style={styles.bookButton} accessibilityRole="button">
          <Text style={[styles.bookText, { fontFamily: f600 }]}>{t('packages.book')}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.locked, { fontFamily: f400 }]}>
          {reason === 'depleted' ? t('packages.locked.depleted') : reason === 'unsupported' || !concrete ? t('packages.locked.support') : t('packages.locked.unavailable')}
        </Text>
      )}
    </View>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>, action: ReturnType<typeof getSawaaRoles>['action']) => StyleSheet.create({
  credit: { borderTopWidth: 1, borderTopColor: sawaaColors.glass.borderSoft, paddingTop: sawaaSpacing.md, gap: sawaaSpacing.xs },
  creditHeader: { justifyContent: 'space-between', alignItems: 'center' },
  creditName: { flex: 1, color: sawaaColors.ink[900], fontSize: sawaaType.body.fontSize },
  remaining: { color: sawaaColors.teal[700], fontSize: sawaaType.caption.fontSize },
  duration: { color: sawaaColors.ink[500], fontSize: sawaaType.caption.fontSize },
  bookButton: { alignSelf: 'flex-start', backgroundColor: action.fill, borderRadius: sawaaRadius.sm, paddingHorizontal: sawaaSpacing.lg, paddingVertical: sawaaSpacing.sm, marginTop: sawaaSpacing.xs },
  bookText: { color: action.foreground, fontSize: sawaaType.caption.fontSize },
  locked: { color: sawaaColors.ink[500], fontSize: sawaaType.caption.fontSize },
});
