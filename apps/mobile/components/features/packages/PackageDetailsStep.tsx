import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { PackageOverview } from '@/components/features/packages/PackageOverview';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { PACKAGE_FLOW_STEPS, packageStepPath } from '@/features/packages/package-flow';
import { usePendingPackageRecovery } from '@/features/packages/use-pending-package-recovery';
import { usePackageFamily } from '@/hooks/queries';
import { useAppSelector } from '@/hooks/use-redux';
import { useDir } from '@/hooks/useDir';
import { goBackOrHome } from '@/lib/navigation';
import { getFontName } from '@/theme/fonts';
import { AquaBackground, sawaaSpacing } from '@/theme/sawaa';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

/**
 * Step 1 of the package flow, shared by the client route and the guest
 * public-detail route: the package overview with option selection.
 */
export function PackageDetailsStep({ familyId }: { familyId?: string }) {
  const colors = useSawaaColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const [footerHeight, setFooterHeight] = useState(180);
  const query = usePackageFamily(familyId);
  const [selectedId, setSelectedId] = useState<string>();
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  useEffect(() => {
    if (!query.data || selectedId) return;
    setSelectedId(query.data.options[0]?.id);
  }, [query.data, selectedId]);

  const option = useMemo(
    () => query.data?.options.find((candidate) => candidate.id === selectedId) ?? query.data?.options[0],
    [query.data?.options, selectedId],
  );

  // This step never opens a checkout; the ref only satisfies the shared recovery.
  const checkoutInFlight = useRef(false);
  usePendingPackageRecovery(option?.id, checkoutInFlight);

  const onContinue = () => {
    if (!query.data || !option) return;
    router.push({
      pathname: packageStepPath('confirm', signedIn),
      params: { familyId: query.data.id, optionId: option.id },
    });
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: query.data ? footerHeight + sawaaSpacing.lg : insets.bottom + sawaaSpacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <BookingStepHeader
          step={1}
          total={PACKAGE_FLOW_STEPS}
          title={t('packages.details')}
          onBack={() => (signedIn ? goBackOrHome(router, '/(client)/packages') : goBackOrHome(router))}
        />
        {query.isLoading ? <Text style={[styles.message, { color: colors.ink[500], fontFamily: f600 }]}>{t('packages.loading')}</Text> : null}
        {!query.isLoading && (query.isError || !query.data) ? (
          <>
            <Text style={[styles.message, { color: colors.ink[500], fontFamily: f600 }]}>{t('packages.error')}</Text>
            <PrimaryButton label={t('common.retry')} fontFamily={f600} disabled={query.isFetching} onPress={() => { void query.refetch(); }} />
          </>
        ) : null}
        {query.data ? (
          <PackageOverview family={query.data} selectedOptionId={option?.id} onSelectOption={setSelectedId} />
        ) : null}
      </ScrollView>
      {query.data ? (
        <FloatingCta onHeightChange={setFooterHeight}>
          <PrimaryButton label={t('common.continue')} fontFamily={f700} disabled={!option} onPress={onContinue} />
        </FloatingCta>
      ) : null}
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  message: { textAlign: 'center', marginTop: sawaaSpacing['3xl'] },
});
