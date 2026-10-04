import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Ticket } from 'lucide-react-native';

import { PackageCard } from '@/components/features/packages/PackageCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { Glass } from '@/theme/components/Glass';
import { AquaBackground, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { usePackageFamilies } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export default function PackagesIndexScreen() {
  const colors = useSawaaColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const query = usePackageFamilies();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;
  const message = [styles.message, { color: colors.ink[500], fontFamily: f600 }];

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t('packages.title')} onBack={() => router.back()} />
        <Text style={[styles.intro, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>{t('packages.intro')}</Text>

        <Glass
          radius={sawaaRadius.lg}
          style={styles.balanceCard}
          onPress={() => router.push('/(client)/packages/purchases')}
          interactive
          accessibilityLabel={t('packages.balance')}
        >
          <View style={[styles.balanceRow, { flexDirection: dir.row }]}>
            <Ticket size={22} color={colors.teal[700]} strokeWidth={1.75} />
            <Text style={[styles.balanceLabel, { color: colors.ink[900], fontFamily: f600, textAlign: dir.textAlign }]}>{t('packages.balance')}</Text>
            <Chevron size={18} color={colors.ink[500]} strokeWidth={1.75} />
          </View>
        </Glass>

        {query.isLoading ? <Text style={message}>{t('packages.loading')}</Text> : null}
        {!query.isLoading && query.isError ? (
          <>
            <Text style={message}>{t('packages.error')}</Text>
            <PrimaryButton label={t('common.retry')} fontFamily={f600} disabled={query.isFetching} onPress={() => { void query.refetch(); }} />
          </>
        ) : null}
        {!query.isLoading && !query.isError && query.data?.length === 0 ? <Text style={message}>{t('packages.empty')}</Text> : null}
        {(query.data ?? []).map((family) => (
          <PackageCard
            key={family.id}
            family={family}
            onPress={() => router.push({ pathname: '/(client)/packages/[id]', params: { id: family.id } })}
          />
        ))}
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  intro: { fontSize: 15, lineHeight: 26 },
  balanceCard: { padding: sawaaSpacing.lg, minHeight: 56, justifyContent: 'center' },
  balanceRow: { alignItems: 'center', gap: sawaaSpacing.md },
  balanceLabel: { flex: 1, fontSize: sawaaType.body.fontSize + 1 },
  message: { textAlign: 'center', marginTop: sawaaSpacing['3xl'] },
});
