import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Glass } from '@/theme/components/Glass';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { usePackagePurchases } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { summarizePackageBalance } from '@/lib/package-balance';

/** Informational only: points a signed-in client with remaining package credit to their balance. */
export function PackageCreditHint() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useSawaaColors();
  const dir = useDir();
  const purchases = usePackagePurchases();
  const balance = summarizePackageBalance(purchases.data);
  if (!balance || balance.remaining <= 0) return null;

  return (
    <Glass radius={sawaaRadius.lg} style={styles.card}>
      <View style={[styles.row, { flexDirection: dir.row }]}>
        <Text style={[styles.text, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>
          {t('booking.packageCreditHint')}
        </Text>
        <Pressable onPress={() => router.push('/(client)/packages/purchases')} accessibilityRole="link" style={styles.link}>
          <Text style={[styles.linkText, { color: colors.teal[700], fontFamily: getFontName(dir.locale, '600') }]}>
            {t('booking.usePackageCredit')}
          </Text>
        </Pressable>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: sawaaSpacing.md },
  row: { flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: sawaaSpacing.sm },
  text: { flexShrink: 1, fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: sawaaType.body.fontSize, textDecorationLine: 'underline' },
});
