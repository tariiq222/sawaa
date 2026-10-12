import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ticket } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { LocalizedHorizontalScroll } from '@/components/ui/LocalizedHorizontalScroll';
import { Pill } from '@/components/ui/Pill';
import { Thumb } from '@/components/ui/Thumb';
import { packageHighlights } from '@/components/features/packages/packageHighlights';
import { Glass } from '@/theme/components/Glass';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import type { DirState } from '@/hooks/useDir';
import { usePackageFamilies } from '@/hooks/queries';
import { useAppSelector } from '@/hooks/use-redux';
import { formatCurrencyAmount } from '@/lib/currency-display';
import { packageGrossHalalas, packageVatRate } from '@/lib/package-vat';

interface HomePackagesSliderProps { dir: DirState; f400: string; f700: string }

const CARD_W = 224;
const TILE = 44;

/**
 * Horizontal slider of every package family. Same card shape as the groups
 * slider: icon tile + two-line name on top, the price in the middle and one
 * pill at the bottom, so cards in both rows line up.
 */
export function HomePackagesSlider({ dir, f400, f700 }: HomePackagesSliderProps) {
  const colors = useSawaaColors();
  const router = useRouter();
  const { t } = useTranslation();
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const families = usePackageFamilies().data ?? [];
  if (families.length === 0) return null;
  return (
    <LocalizedHorizontalScroll dir={dir} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.list, { flexDirection: dir.row }]}>
      {families.map((family) => {
        const name = (dir.isRTL ? family.nameAr : family.nameEn ?? family.nameAr) ?? '';
        const description = (dir.isRTL ? family.descriptionAr : family.descriptionEn ?? family.descriptionAr)?.trim();
        const vatRate = packageVatRate(family);
        const lowest = family.options.reduce((min, option) => Math.min(min, packageGrossHalalas(option.price.finalPrice, vatRate)), Number.POSITIVE_INFINITY);
        // Several options: show the sessions line («تبدأ من N جلسة»), not the option count.
        const highlights = packageHighlights(family, dir.isRTL, t);
        const highlight = family.options.length > 1 ? highlights[1] : highlights[0];
        return (
          <Glass
            key={family.id}
            variant="strong"
            radius={sawaaRadius.lg}
            accessibilityRole="button"
            accessibilityLabel={name}
            onPress={() => router.push(signedIn
              ? { pathname: '/(client)/packages/[id]', params: { id: family.id } }
              : { pathname: '/public-detail/[kind]/[id]', params: { kind: 'package', id: family.id } })}
            style={styles.card}
          >
            <View style={[styles.top, { flexDirection: dir.row }]}>
              <Thumb uri={null} width={TILE} height={TILE} radius={sawaaRadius.md} icon={Ticket} />
              <Text numberOfLines={2} style={[styles.name, { fontFamily: f700, color: colors.ink[900], textAlign: dir.textAlign }]}>{name}</Text>
            </View>
            {description ? (
              <Text numberOfLines={2} style={[styles.description, { fontFamily: f400, color: colors.ink[700], textAlign: dir.textAlign }]}>{description}</Text>
            ) : null}
            <View style={styles.priceBlock}>
              {family.options.length > 1 ? (
                <Text style={[styles.caption, { fontFamily: f400, color: colors.ink[500], textAlign: dir.textAlign }]}>{t('packages.startsFrom')}</Text>
              ) : null}
              <Text style={[styles.price, { fontFamily: f700, color: colors.teal[700], textAlign: dir.textAlign }]}>
                {Number.isFinite(lowest) ? formatCurrencyAmount(lowest, 'SAR', dir.isRTL) : ''}
              </Text>
            </View>
            {highlight ? (
              <View style={{ alignSelf: dir.isRTL ? 'flex-end' : 'flex-start' }}>
                <Pill tone="muted" label={highlight} />
              </View>
            ) : null}
          </Glass>
        );
      })}
    </LocalizedHorizontalScroll>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, paddingHorizontal: 2 },
  card: { width: CARD_W, minHeight: 200, padding: sawaaSpacing.md, gap: sawaaSpacing.sm, justifyContent: 'space-between' },
  top: { alignItems: 'center', gap: sawaaSpacing.sm },
  name: { flex: 1, minWidth: 0, fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  priceBlock: { gap: 0 },
  description: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight },
  caption: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight },
  price: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
});
