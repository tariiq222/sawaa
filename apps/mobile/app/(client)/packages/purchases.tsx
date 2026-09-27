import React, { useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { Glass } from '@/theme/components/Glass';
import { AquaBackground, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { usePackagePurchases } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';
import { formatHalalas } from '@/lib/package-utils';
import { PackageCreditCard } from '@/components/features/packages/PackageCreditCard';
import { BackButton } from '@/components/ui/BackButton';

export default function PackagePurchasesScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const query = usePackagePurchases();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  return (
    <AquaBackground>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + sawaaSpacing.lg }]}>
        <View style={[styles.header, { flexDirection: dir.row }]}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('packages.balance')}</Text>
        </View>
        {query.isLoading ? <Text style={[styles.message, { fontFamily: f600 }]}>{t('packages.loading')}</Text> : null}
        {!query.isLoading && query.isError ? (
          <>
            <Text style={[styles.message, { fontFamily: f600 }]}>{t('packages.error')}</Text>
            <PrimaryButton label={t('common.retry')} fontFamily={f600} disabled={query.isFetching} onPress={() => { void query.refetch(); }} />
          </>
        ) : null}
        {(query.data ?? []).map((purchase) => (
          <Glass key={purchase.id} variant="strong" radius={sawaaRadius.lg} style={styles.purchase}>
            <Text style={[styles.purchaseName, { fontFamily: f700, textAlign: dir.textAlign }]}>
              {purchase.offerSnapshot
                ? (dir.isRTL ? purchase.offerSnapshot.familyNameAr : purchase.offerSnapshot.familyNameEn ?? purchase.offerSnapshot.familyNameAr)
                : (dir.isRTL ? purchase.packageNameAr : purchase.packageNameEn ?? purchase.packageNameAr)}
            </Text>
            <View style={[styles.purchaseMeta, { flexDirection: dir.row }]}>
              <Text style={[styles.metaText, { fontFamily: f400 }]}>{t(`packages.status.${purchase.status.toLowerCase()}`)}</Text>
              <Text style={[styles.metaText, { fontFamily: f600 }]}>{formatHalalas(purchase.amountPaid, dir.locale)}</Text>
            </View>
            {purchase.refundAmount > 0 ? (
              <Text style={[styles.refund, { fontFamily: f400 }]}>{t('packages.refund', { amount: formatHalalas(purchase.refundAmount, dir.locale) })}</Text>
            ) : null}
            {purchase.credits.map((credit) => (
              <PackageCreditCard
                key={credit.id}
                credit={credit}
                dir={dir}
                f400={f400}
                f600={f600}
                f700={f700}
                onBook={(selected) => router.push({ pathname: '/(client)/packages/book', params: {
                  creditId: selected.id,
                  serviceId: selected.serviceId as string,
                  employeeId: selected.employeeId as string,
                  durationOptionId: selected.durationOptionId as string,
                  durationMins: selected.durationMins ? String(selected.durationMins) : '',
                  deliveryType: selected.deliveryTypeSnapshot ?? 'IN_PERSON',
                } })}
              />
            ))}
          </Glass>
        ))}
        {!query.isLoading && !query.isError && query.data?.length === 0 ? (
          <Text style={[styles.message, { fontFamily: f600 }]}>{t('packages.noPurchases')}</Text>
        ) : null}
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, paddingBottom: 120, gap: sawaaSpacing.md },
  header: { alignItems: 'center', gap: sawaaSpacing.md },
  title: { flex: 1, color: colors.ink[900], fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  message: { color: colors.ink[500], textAlign: 'center', marginTop: sawaaSpacing['3xl'] },
  purchase: { padding: sawaaSpacing.lg, gap: sawaaSpacing.sm },
  purchaseName: { color: colors.ink[900], fontSize: sawaaType.subheading.fontSize },
  purchaseMeta: { justifyContent: 'space-between' },
  metaText: { color: colors.ink[500], fontSize: sawaaType.caption.fontSize },
  refund: { color: colors.accent.amber, fontSize: sawaaType.caption.fontSize },
});
