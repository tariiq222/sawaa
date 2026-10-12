import React, { useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Layers, ListChecks, Package, Receipt, Wallet } from 'lucide-react-native';

import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { InfoRows, type InfoRow } from '@/components/ui/InfoRows';
import { PACKAGE_FLOW_STEPS, resolveDefaultBranch } from '@/features/packages/package-flow';
import { usePendingPackageRecovery } from '@/features/packages/use-pending-package-recovery';
import { useInitPackagePurchase, usePackageFamily, usePublicBranches } from '@/hooks/queries';
import { useAppSelector } from '@/hooks/use-redux';
import { useDir } from '@/hooks/useDir';
import { formatCurrencyAmount } from '@/lib/currency-display';
import { goBackOrHome, loginRedirectHref } from '@/lib/navigation';
import { runPackageCheckout } from '@/lib/package-checkout';
import { packagePurchaseErrorKey } from '@/lib/package-utils';
import { packageGrossHalalas, packageVatHalalas, packageVatRate } from '@/lib/package-vat';
import { getFontName } from '@/theme/fonts';
import { AquaBackground, sawaaSpacing } from '@/theme/sawaa';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

/**
 * Step 2 of the package flow (client route; guests open the public re-export).
 * Guests are asked to sign in here and return to this same step afterwards.
 * The branch is resolved silently (single-branch centre), never asked for.
 */
export default function PackageConfirmScreen() {
  const colors = useSawaaColors();
  const { familyId: familyParam, optionId } = useLocalSearchParams<{ familyId?: string; optionId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const [footerHeight, setFooterHeight] = useState(180);
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const user = useAppSelector((state) => state.auth.user);
  const query = usePackageFamily(familyParam);
  const branchQuery = usePublicBranches();
  const userRef = useRef(user?.id);
  userRef.current = user?.id;
  const initPurchase = useInitPackagePurchase();
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const option = useMemo(
    () => query.data?.options.find((candidate) => candidate.id === optionId) ?? query.data?.options[0],
    [query.data?.options, optionId],
  );
  const branchId = resolveDefaultBranch(branchQuery.data)?.id;

  // True while this screen owns an open checkout, so the foreground listener
  // does not race the purchase flow's own navigation.
  const checkoutInFlight = useRef(false);
  usePendingPackageRecovery(option?.id, checkoutInFlight);

  const handlePurchase = async () => {
    if (!query.data || !option || !branchId || !user?.id || initPurchase.isPending || checkoutInFlight.current) return;
    const familyId = query.data.isStandalone ? '' : query.data.id;
    checkoutInFlight.current = true;
    try {
      const target = { clientId: user.id, packageId: option.id, familyId, branchId };
      const result = await runPackageCheckout(initPurchase.mutateAsync, target);
      if (userRef.current !== target.clientId) return;
      router.replace({
        pathname: '/(client)/payments/native-checkout',
        params: { purchaseId: result.purchaseId, invoiceId: result.invoiceId },
      });
    } catch (error) {
      Alert.alert(t('packages.errorTitle'), t(packagePurchaseErrorKey(error)));
    } finally {
      checkoutInFlight.current = false;
    }
  };

  const signIn = () => {
    router.push(loginRedirectHref(['(client)', 'packages', 'confirm'], { familyId: familyParam, optionId }));
  };

  const vatRate = packageVatRate(query.data);
  const purchaseDisabled = initPurchase.isPending || !option || !branchId || !user?.id;
  const localName = (candidate: { nameAr: string; nameEn?: string | null }) => (dir.isRTL ? candidate.nameAr : candidate.nameEn ?? candidate.nameAr);
  const money = (halalas: number) => formatCurrencyAmount(halalas, 'SAR', dir.isRTL);

  const rows: InfoRow[] = [];
  if (query.data && option) {
    const net = option.price.finalPrice;
    rows.push(
      { icon: Package, label: t('packages.summaryPackage'), value: localName(query.data) },
      { icon: Layers, label: t('packages.summaryOption'), value: localName(option) },
      { icon: ListChecks, label: t('packages.summarySessions'), value: t('packages.sessionCount', { count: option.sessionCount }) },
    );
    if (vatRate > 0) {
      rows.push(
        { icon: Wallet, label: t('packages.summaryPrice'), value: money(net) },
        { icon: Receipt, label: t('packages.summaryVat'), value: money(packageVatHalalas(net, vatRate)) },
      );
    }
    rows.push({ icon: Wallet, label: t('packages.summaryTotal'), value: money(packageGrossHalalas(net, vatRate)) });
  }

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: query.data ? footerHeight + sawaaSpacing.lg : insets.bottom + sawaaSpacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <BookingStepHeader
          step={2}
          total={PACKAGE_FLOW_STEPS}
          title={t('packages.confirmTitle')}
          onBack={() => (signedIn ? goBackOrHome(router, '/(client)/packages') : goBackOrHome(router))}
        />
        {query.isLoading ? <Text style={[styles.message, { color: colors.ink[500], fontFamily: f600 }]}>{t('packages.loading')}</Text> : null}
        {!query.isLoading && (query.isError || !query.data) ? (
          <>
            <Text style={[styles.message, { color: colors.ink[500], fontFamily: f600 }]}>{t('packages.error')}</Text>
            <PrimaryButton label={t('common.retry')} fontFamily={f600} disabled={query.isFetching} onPress={() => { void query.refetch(); }} />
          </>
        ) : null}
        {rows.length > 0 ? <InfoRows rows={rows} /> : null}
        {query.data && !branchId && !branchQuery.isFetching ? (
          <Text style={[styles.message, { color: colors.ink[500], fontFamily: f600 }]}>{t('packages.branchUnavailable')}</Text>
        ) : null}
      </ScrollView>
      {query.data ? (
        <FloatingCta onHeightChange={setFooterHeight}>
          {signedIn ? (
            <PrimaryButton
              label={t('packages.purchase')}
              fontFamily={f700}
              disabled={purchaseDisabled}
              loading={initPurchase.isPending}
              onPress={handlePurchase}
            />
          ) : (
            <PrimaryButton
              label={t('booking.signInOrRegisterToContinue')}
              fontFamily={f700}
              disabled={!option}
              onPress={signIn}
            />
          )}
        </FloatingCta>
      ) : null}
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  message: { textAlign: 'center', marginTop: sawaaSpacing['3xl'] },
});
