import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Glass } from '@/theme/components/Glass';
import { usePackagePurchases } from '@/hooks/queries';
import { summarizePackageBalance } from '@/lib/package-balance';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

/** Real package balance from the purchases query; renders nothing when there is no active package. */
export function PackageBalanceCard() {
  const colors = useSawaaColors();
  const dir = useDir();
  const router = useRouter();
  const { t } = useTranslation();
  const query = usePackagePurchases();
  const summary = summarizePackageBalance(query.data);
  if (!summary) return null;
  const Arrow = dir.isRTL ? ChevronLeft : ChevronRight;
  const share = Math.max(0, Math.min(1, summary.remaining / summary.total));
  const count = t('home.packageBalanceCount', { remaining: summary.remaining, total: summary.total });
  return (
    <Glass variant="strong" radius={sawaaRadius.lg} padding={16}
      onPress={() => router.push('/(client)/packages/purchases')}
      accessibilityRole="button" accessibilityLabel={`${t('home.packageBalance')}: ${count}`} interactive>
      <View style={[styles.row, { flexDirection: dir.row }]}>
        <View style={styles.body}>
          <Text style={[styles.label, { fontFamily: getFontName(dir.locale, '400'), color: colors.ink[500], textAlign: dir.textAlign }]}>{t('home.packageBalance')}</Text>
          <Text style={[styles.count, { fontFamily: getFontName(dir.locale, '700'), color: colors.ink[900], textAlign: dir.textAlign }]}>{count}</Text>
        </View>
        <Arrow size={20} color={colors.teal[700]} strokeWidth={2} />
      </View>
      <View style={[styles.track, { backgroundColor: colors.teal[100], flexDirection: dir.row }]}>
        <View style={[styles.fill, { backgroundColor: colors.teal[600], width: `${Math.round(share * 100)}%` }]} />
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 12 },
  body: { flex: 1, gap: 2 },
  label: { fontSize: 13, lineHeight: 18 },
  count: { fontSize: 16, lineHeight: 22 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  fill: { height: 8, borderRadius: 4 },
});
