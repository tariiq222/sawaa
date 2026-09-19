import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Glass } from '@/theme/components/Glass';
import { AquaBackground, sawaaColors, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { usePackageFamilies } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';
import { formatHalalas } from '@/lib/package-utils';

export default function PackagesIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const query = usePackageFamilies();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  return (
    <AquaBackground>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + sawaaSpacing.lg }]}>
        <View style={[styles.header, { flexDirection: dir.row }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('a11y.buttonBack')}>
            <Text style={[styles.back, { fontFamily: f700 }]}>{dir.isRTL ? '‹' : '›'}</Text>
          </Pressable>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('packages.title')}</Text>
        </View>
        <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign }]}>{t('packages.subtitle')}</Text>

        {query.isLoading ? <Text style={[styles.message, { fontFamily: f600 }]}>{t('packages.loading')}</Text> : null}
        {query.isError ? <Text style={[styles.message, { fontFamily: f600 }]}>{t('packages.error')}</Text> : null}
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

const styles = StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, paddingBottom: 120, gap: sawaaSpacing.md },
  header: { alignItems: 'center', gap: sawaaSpacing.md },
  back: { color: sawaaColors.teal[700], fontSize: 34, lineHeight: 34 },
  title: { flex: 1, color: sawaaColors.ink[900], fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  subtitle: { color: sawaaColors.ink[500], fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  message: { color: sawaaColors.ink[500], textAlign: 'center', marginTop: sawaaSpacing['3xl'] },
  card: { minHeight: 140, overflow: 'hidden' },
  image: { width: '100%', height: 120 },
  cardBody: { padding: sawaaSpacing.lg, gap: sawaaSpacing.xs },
  cardTitle: { color: sawaaColors.ink[900], fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  cardDescription: { color: sawaaColors.ink[500], fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  meta: { justifyContent: 'space-between', alignItems: 'center', marginTop: sawaaSpacing.sm },
  metaText: { color: sawaaColors.teal[700], fontSize: sawaaType.caption.fontSize },
  price: { color: sawaaColors.ink[900], fontSize: sawaaType.body.fontSize },
});
