import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Alert, AppState, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { Glass } from '@/theme/components/Glass';
import { AquaBackground, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { useInitPackagePurchase, usePackageFamily } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';
import { publicBranchesService } from '@/services/client';
import { getPendingPackagePurchase } from '@/services/client/packages';
import { runPackageCheckout } from '@/lib/package-checkout';
import { packagePurchaseErrorKey } from '@/lib/package-utils';
import type { PublicBranchSummary } from '@/services/client';
import { formatCurrencyAmount } from '@/lib/currency-display';
import { packageGrossHalalas, packageVatHalalas, packageVatRate } from '@/lib/package-vat';
import { PackageBranchPicker } from '@/components/features/packages/PackageBranchPicker';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';

export default function PackageFamilyDetailScreen() {
  const colors = useSawaaColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const query = usePackageFamily(id);
  const initPurchase = useInitPackagePurchase();
  const [selectedId, setSelectedId] = useState<string>();
  const [branches, setBranches] = useState<PublicBranchSummary[]>([]);
  const [branchId, setBranchId] = useState<string>();
  const [branchLoading, setBranchLoading] = useState(true);
  const [branchError, setBranchError] = useState(false);
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  useEffect(() => {
    if (!query.data || selectedId) return;
    setSelectedId(query.data.options[0]?.id);
  }, [query.data, selectedId]);

  const loadBranches = useCallback(async () => {
    setBranchLoading(true);
    setBranchError(false);
    try {
      const loaded = await publicBranchesService.list();
      setBranches(loaded);
      setBranchId((current) => current && loaded.some((branch) => branch.id === current) ? current : loaded[0]?.id);
    } catch {
      setBranchError(true);
    } finally {
      setBranchLoading(false);
    }
  }, []);

  useEffect(() => { void loadBranches(); }, [loadBranches]);

  const option = useMemo(
    () => query.data?.options.find((candidate) => candidate.id === selectedId) ?? query.data?.options[0],
    [query.data?.options, selectedId],
  );

  // True while this screen owns an open checkout, so the foreground listener
  // does not race the purchase flow's own navigation.
  const checkoutInFlight = useRef(false);

  const recoverPending = useCallback(async () => {
    if (checkoutInFlight.current) return;
    const pending = await getPendingPackagePurchase();
    // The return screen clears this record once a checkout fails, is abandoned,
    // or stays unconfirmed, so recovery cannot loop the client away from Buy.
    if (checkoutInFlight.current) return;
    if (pending && pending.clientId === user?.id && pending.packageId === option?.id) {
      router.replace({ pathname: '/(client)/packages/return', params: {
        purchaseId: pending.purchaseId,
        clientId: pending.clientId,
        packageId: pending.packageId,
        familyId: pending.familyId,
        branchId: pending.branchId,
      } });
    }
  }, [option?.id, router, user?.id]);

  useEffect(() => {
    let cancelled = false;
    void recoverPending();
    const subscription = AppState.addEventListener('change', (state) => {
      if (!cancelled && state === 'active') void recoverPending();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [recoverPending]);

  const handlePurchase = async () => {
    if (!query.data || !option || !branchId || !user?.id || initPurchase.isPending || checkoutInFlight.current) return;
    const familyId = query.data.isStandalone ? '' : query.data.id;
    checkoutInFlight.current = true;
    try {
      const target = { clientId: user.id, packageId: option.id, familyId, branchId };
      const result = await runPackageCheckout(initPurchase.mutateAsync, target);
      router.replace({
        pathname: '/(client)/packages/return',
        params: { purchaseId: result.purchaseId, ...target, signal: result.signal },
      });
    } catch (error) {
      Alert.alert(t('packages.errorTitle'), t(packagePurchaseErrorKey(error)));
    } finally {
      checkoutInFlight.current = false;
    }
  };

  const vatRate = packageVatRate(query.data);
  const purchaseDisabled = initPurchase.isPending || !option || !branchId || !user?.id;
  const optionName = (candidate: { nameAr: string; nameEn?: string | null }) => (dir.isRTL ? candidate.nameAr : candidate.nameEn ?? candidate.nameAr);

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 180 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t('packages.details')} onBack={() => router.back()} />
        {query.isLoading ? <Text style={[styles.message, { color: colors.ink[500], fontFamily: f600 }]}>{t('packages.loading')}</Text> : null}
        {!query.isLoading && (query.isError || !query.data) ? (
          <>
            <Text style={[styles.message, { color: colors.ink[500], fontFamily: f600 }]}>{t('packages.error')}</Text>
            <PrimaryButton label={t('common.retry')} fontFamily={f600} disabled={query.isFetching} onPress={() => { void query.refetch(); }} />
          </>
        ) : null}
        {query.data ? (
          <>
            {query.data.imageUrl ? <Image source={{ uri: query.data.imageUrl }} style={styles.image} /> : null}
            <View style={styles.intro}>
              <Text style={[styles.familyName, { color: colors.ink[900], fontFamily: f700, textAlign: dir.textAlign }]}>
                {optionName(query.data)}
              </Text>
              <Text style={[styles.description, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>
                {dir.isRTL ? query.data.descriptionAr : query.data.descriptionEn ?? query.data.descriptionAr}
              </Text>
            </View>
            <SectionHeader title={t('packages.chooseOption')} />
            {query.data.options.map((candidate) => {
              const selected = candidate.id === option?.id;
              const net = candidate.price.finalPrice;
              return (
                <Glass
                  key={candidate.id}
                  radius={sawaaRadius.lg}
                  style={[styles.option, selected && { borderWidth: 2, borderColor: colors.teal[600] }]}
                  onPress={() => setSelectedId(candidate.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.optionRow, { flexDirection: dir.row }]}>
                    <Text style={[styles.optionName, { color: colors.ink[900], fontFamily: f700 }]}>{optionName(candidate)}</Text>
                    <Text style={[styles.optionPrice, { color: colors.teal[700], fontFamily: f700 }]}>{formatCurrencyAmount(packageGrossHalalas(net, vatRate), 'SAR', dir.isRTL)}</Text>
                  </View>
                  {vatRate > 0 ? (
                    <Text style={[styles.vatNote, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>
                      {t('packages.vatIncluded')} · {t('packages.vatBreakdown', {
                        net: formatCurrencyAmount(net, 'SAR', dir.isRTL),
                        vat: formatCurrencyAmount(packageVatHalalas(net, vatRate), 'SAR', dir.isRTL),
                      })}
                    </Text>
                  ) : null}
                  <Text style={[styles.optionCount, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>
                    {t('packages.sessionCount', { count: candidate.sessionCount })}
                  </Text>
                  {(candidate.displayGroups?.length ? candidate.displayGroups : (candidate.groups ?? []).map((group) => ({
                    key: group.key,
                    label: group.label,
                    serviceNameAr: '',
                    serviceNameEn: null,
                    employeeName: '',
                    sessions: group.sessions.map((session, position) => ({ position, durationMins: 0, deliveryType: session.deliveryType })),
                  }))).map((group) => (
                    <View key={group.key} style={[styles.groupDetail, { borderTopColor: colors.ink[400] }]}>
                      <Text style={[styles.groupLabel, { color: colors.ink[700], fontFamily: f600, textAlign: dir.textAlign }]}>
                        {group.label || t('packages.groupLabel', { key: group.key })}
                      </Text>
                      <Text style={[styles.groupMeta, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>
                        {group.serviceNameAr || group.serviceNameEn
                          ? t('packages.groupComposition', {
                            sessions: group.sessions.length,
                            service: dir.isRTL ? group.serviceNameAr : group.serviceNameEn ?? group.serviceNameAr,
                            practitioner: group.employeeName,
                            durations: group.sessions.map((session) => session.durationMins > 0
                              ? t('packages.durationMinutes', { minutes: session.durationMins, delivery: session.deliveryType === 'ONLINE' ? t('packages.online') : t('packages.inPerson') })
                              : t('packages.sessionIncluded')).join(', '),
                          })
                          : t('packages.groupFallback', { sessions: group.sessions.length })}
                      </Text>
                    </View>
                  ))}
                </Glass>
              );
            })}
            <PackageBranchPicker
              branches={branches}
              branchId={branchId}
              loading={branchLoading}
              error={branchError}
              onSelect={setBranchId}
              onRetry={() => { void loadBranches(); }}
              dir={dir}
              f400={f400}
              f600={f600}
              f700={f700}
            />
          </>
        ) : null}
      </ScrollView>
      {query.data ? (
        <FloatingCta>
          <PrimaryButton
            label={initPurchase.isPending ? t('packages.purchasing') : t('packages.purchase')}
            fontFamily={f700}
            disabled={purchaseDisabled}
            onPress={handlePurchase}
          />
        </FloatingCta>
      ) : null}
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  message: { textAlign: 'center', marginTop: sawaaSpacing['3xl'] },
  image: { width: '100%', height: 160, borderRadius: sawaaRadius.lg },
  intro: { gap: sawaaSpacing.sm },
  familyName: { fontSize: sawaaType.heading.fontSize - 2, lineHeight: sawaaType.heading.lineHeight },
  description: { fontSize: 15, lineHeight: 24 },
  option: { padding: sawaaSpacing.lg, minHeight: 80 },
  optionRow: { justifyContent: 'space-between', alignItems: 'center', gap: sawaaSpacing.md },
  optionName: { flex: 1, fontSize: 16 },
  optionPrice: { fontSize: 16 },
  optionCount: { fontSize: 14, marginTop: sawaaSpacing.xs },
  vatNote: { fontSize: sawaaType.caption.fontSize, marginTop: sawaaSpacing.xs },
  groupDetail: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: sawaaSpacing.sm, paddingTop: sawaaSpacing.sm, gap: sawaaSpacing.xs },
  groupLabel: { fontSize: sawaaType.caption.fontSize + 1 },
  groupMeta: { fontSize: sawaaType.caption.fontSize, lineHeight: 18 },
});
