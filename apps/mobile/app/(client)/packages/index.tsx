import React, { useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Ticket } from 'lucide-react-native';

import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { Glass } from '@/theme/components/Glass';
import { AquaBackground, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { usePackageFamilies } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';
import { formatHalalas } from '@/lib/package-utils';
import { BackButton } from '@/components/ui/BackButton';

export default function PackagesIndexScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const query = usePackageFamilies();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;

  return (
    <AquaBackground>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + sawaaSpacing.lg }]}>
        <View style={[styles.header, { flexDirection: dir.row }]}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('packages.title')}</Text>
        </View>
        <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign }]}>{t('packages.subtitle')}</Text>

        <Glass
          variant="strong"
          radius={sawaaRadius.lg}
          style={styles.balanceCard}
          onPress={() => router.push('/(client)/packages/purchases')}
          interactive
          accessibilityLabel={t('packages.balance')}
        >
          <View style={[styles.balanceRow, { flexDirection: dir.row }]}>
            <Ticket size={20} color={colors.teal[600]} strokeWidth={1.75} />
            <Text style={[styles.balanceLabel, { fontFamily: f600, textAlign: dir.textAlign }]}>{t('packages.balance')}</Text>
            <Chevron size={18} color={colors.ink[400]} strokeWidth={1.75} />
          </View>
        </Glass>

        {query.isLoading ? <Text style={[styles.message, { fontFamily: f600 }]}>{t('packages.loading')}</Text> : null}
        {!query.isLoading && query.isError ? (
          <>
            <Text style={[styles.message, { fontFamily: f600 }]}>{t('packages.error')}</Text>
            <PrimaryButton label={t('common.retry')} fontFamily={f600} disabled={query.isFetching} onPress={() => { void query.refetch(); }} />
          </>
        ) : null}
        {!query.isLoading && !query.isError && query.data?.length === 0 ? (
          <Text style={[styles.message, { fontFamily: f600 }]}>{t('packages.empty')}</Text>
        ) : null}
        {(query.data ?? []).map((family) => {
          const first = family.options[0];
          const minimum = family.options.reduce((min, option) => Math.min(min, option.price.finalPrice), Number.POSITIVE_INFINITY);
          return (
            <Glass
              key={family.id}
              variant="strong"
              radius={sawaaRadius.lg}
              style={styles.card}
              onPress={() => router.push({ pathname: '/(client)/packages/[id]', params: { id: family.id } })}
              accessibilityLabel={dir.isRTL ? family.nameAr : family.nameEn ?? family.nameAr}
            >
              {family.imageUrl ? <Image source={{ uri: family.imageUrl }} style={styles.image} /> : null}
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
                  {dir.isRTL ? family.nameAr : family.nameEn ?? family.nameAr}
                </Text>
                <Text style={[styles.cardDescription, { fontFamily: f400, textAlign: dir.textAlign }]}>
                  {dir.isRTL ? family.descriptionAr : family.descriptionEn ?? family.descriptionAr}
                </Text>
                <View style={[styles.meta, { flexDirection: dir.row }]}>
                  <Text style={[styles.metaText, { fontFamily: f600 }]}>
                    {t('packages.optionsCount', { count: family.options.length })}
                  </Text>
                  {first && Number.isFinite(minimum) ? (
                    <Text style={[styles.price, { fontFamily: f700 }]}>{formatHalalas(minimum, dir.locale)}</Text>
                  ) : null}
                </View>
              </View>
            </Glass>
          );
        })}
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, paddingBottom: 120, gap: sawaaSpacing.md },
  header: { alignItems: 'center', gap: sawaaSpacing.md },
  title: { flex: 1, color: colors.ink[900], fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  subtitle: { color: colors.ink[500], fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  balanceCard: { padding: sawaaSpacing.lg },
  balanceRow: { alignItems: 'center', gap: sawaaSpacing.md },
  balanceLabel: { flex: 1, color: colors.ink[900], fontSize: sawaaType.body.fontSize },
  message: { color: colors.ink[500], textAlign: 'center', marginTop: sawaaSpacing['3xl'] },
  card: { minHeight: 140, overflow: 'hidden' },
  image: { width: '100%', height: 120 },
  cardBody: { padding: sawaaSpacing.lg, gap: sawaaSpacing.xs },
  cardTitle: { color: colors.ink[900], fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  cardDescription: { color: colors.ink[500], fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  meta: { justifyContent: 'space-between', alignItems: 'center', marginTop: sawaaSpacing.sm },
  metaText: { color: colors.teal[700], fontSize: sawaaType.caption.fontSize },
  price: { color: colors.ink[900], fontSize: sawaaType.body.fontSize },
});
