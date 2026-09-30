import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import type { PackageFamily } from '@sawaa/shared/types';
import { useTranslation } from 'react-i18next';

import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useDir } from '@/hooks/useDir';
import { formatCurrencyAmount } from '@/lib/currency-display';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

import { packageHighlights } from './packageHighlights';

/**
 * Package family card: name, lowest option price (integer halalas, no VAT),
 * feature checks from real catalog fields and a buy action that opens the
 * family to choose an option and branch. There is no "most popular" flag in the
 * data, so every card uses the same secondary action.
 */
export function PackageCard({ family, onPress }: { family: PackageFamily; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useSawaaColors();
  const dir = useDir();
  const name = (dir.isRTL ? family.nameAr : family.nameEn ?? family.nameAr) ?? '';
  const description = (dir.isRTL ? family.descriptionAr : family.descriptionEn ?? family.descriptionAr) ?? null;
  const lowest = family.options.reduce((min, option) => Math.min(min, option.price.finalPrice), Number.POSITIVE_INFINITY);
  const highlights = packageHighlights(family, dir.isRTL, t);
  return (
    <Glass radius={sawaaRadius.xl} style={styles.card} accessibilityLabel={name}>
      <Text accessibilityRole="header" style={[styles.name, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}>{name}</Text>
      {Number.isFinite(lowest) ? (
        <View style={styles.priceBlock}>
          {family.options.length > 1 ? (
            <Text style={[styles.priceCaption, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>{t('packages.startsFrom')}</Text>
          ) : null}
          <Text style={[styles.price, { color: colors.teal[700], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}>
            {formatCurrencyAmount(lowest, 'SAR', dir.isRTL)}
          </Text>
        </View>
      ) : null}
      {description ? (
        <Text numberOfLines={3} style={[styles.description, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>{description}</Text>
      ) : null}
      {highlights.length > 0 ? (
        <View style={styles.highlights}>
          {highlights.map((line) => (
            <View key={line} style={[styles.highlight, { flexDirection: dir.row }]}>
              <Check size={18} color={colors.teal[700]} strokeWidth={2.25} />
              <Text style={[styles.highlightText, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <SecondaryButton label={t('packages.buy')} onPress={onPress} />
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: sawaaSpacing.lg, gap: sawaaSpacing.md },
  name: { fontSize: sawaaType.subheading.fontSize - 2, lineHeight: 22 },
  priceBlock: { gap: 0 },
  priceCaption: { fontSize: 13 },
  price: { fontSize: 32, lineHeight: 40 },
  description: { fontSize: 14, lineHeight: 20 },
  highlights: { gap: sawaaSpacing.sm },
  highlight: { alignItems: 'center', gap: 10 },
  highlightText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
