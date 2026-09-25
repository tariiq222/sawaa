import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { Alert, AppState, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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
import { getPackagePurchaseAttemptKey, getPendingPackagePurchase, savePendingPackagePurchase } from '@/services/client/packages';
import type { PublicBranchSummary } from '@/services/client';
import { formatHalalas } from '@/lib/package-utils';
import { PackageBranchPicker } from '@/components/features/packages/PackageBranchPicker';

export default function PackageFamilyDetailScreen() {
  const colors = useSawaaColors();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(colors, theme.colors), [colors, theme.colors]);
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

  const recoverPending = useCallback(async () => {
    const pending = await getPendingPackagePurchase();
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
    if (!query.data || !option || !branchId || !user?.id || initPurchase.isPending) return;
    const familyId = query.data.isStandalone ? undefined : query.data.id;
    try {
      const idempotencyKey = await getPackagePurchaseAttemptKey(user.id, option.id, familyId, branchId);
      const result = await initPurchase.mutateAsync({
        packageId: option.id,
        ...(familyId ? { packageFamilyId: familyId } : {}),
        branchId,
        idempotencyKey,
      });
      await savePendingPackagePurchase({
        purchaseId: result.purchaseId,
        clientId: user.id,
        packageId: option.id,
        familyId: familyId ?? '',
        branchId,
      });
      await WebBrowser.openBrowserAsync(result.redirectUrl);
      router.replace({
        pathname: '/(client)/packages/return',
        params: {
          purchaseId: result.purchaseId,
          clientId: user.id,
          packageId: option.id,
          familyId: familyId ?? '',
          branchId,
        },
      });
    } catch {
      Alert.alert(t('packages.errorTitle'), t('packages.purchaseError'));
    }
  };

  return (
    <AquaBackground>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + sawaaSpacing.lg }]}>
        <View style={[styles.header, { flexDirection: dir.row }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('a11y.buttonBack')}>
            <Text style={[styles.back, { fontFamily: f700 }]}>{dir.isRTL ? '›' : '‹'}</Text>
          </Pressable>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('packages.details')}</Text>
        </View>
        {query.isLoading ? <Text style={[styles.message, { fontFamily: f600 }]}>{t('packages.loading')}</Text> : null}
        {!query.isLoading && (query.isError || !query.data) ? (
          <>
            <Text style={[styles.message, { fontFamily: f600 }]}>{t('packages.error')}</Text>
            <PrimaryButton label={t('common.retry')} fontFamily={f600} disabled={query.isFetching} onPress={() => { void query.refetch(); }} />
          </>
        ) : null}
        {query.data ? (
          <>
            {query.data.imageUrl ? <Image source={{ uri: query.data.imageUrl }} style={styles.image} /> : null}
            <Text style={[styles.familyName, { fontFamily: f700, textAlign: dir.textAlign }]}>
              {dir.isRTL ? query.data.nameAr : query.data.nameEn ?? query.data.nameAr}
            </Text>
            <Text style={[styles.description, { fontFamily: f400, textAlign: dir.textAlign }]}>
              {dir.isRTL ? query.data.descriptionAr : query.data.descriptionEn ?? query.data.descriptionAr}
            </Text>
            <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('packages.chooseOption')}</Text>
            {query.data.options.map((candidate) => {
              const selected = candidate.id === option?.id;
              return (
                <Glass
                  key={candidate.id}
                  variant={selected ? 'strong' : 'regular'}
                  radius={sawaaRadius.md}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => setSelectedId(candidate.id)}
                >
                  <View style={[styles.optionRow, { flexDirection: dir.row }]}>
                    <Text style={[styles.optionName, { fontFamily: f600 }]}>{dir.isRTL ? candidate.nameAr : candidate.nameEn ?? candidate.nameAr}</Text>
                    <Text style={[styles.optionPrice, { fontFamily: f700 }]}>{formatHalalas(candidate.price.finalPrice, dir.locale)}</Text>
                  </View>
                  <Text style={[styles.optionCount, { fontFamily: f400, textAlign: dir.textAlign }]}>
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
                    <View key={group.key} style={styles.groupDetail}>
                      <Text style={[styles.groupLabel, { fontFamily: f600, textAlign: dir.textAlign }]}>
                        {group.label || t('packages.groupLabel', { key: group.key })}
                      </Text>
                      <Text style={[styles.groupMeta, { fontFamily: f400, textAlign: dir.textAlign }]}>
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
            <Pressable
              onPress={handlePurchase}
              disabled={initPurchase.isPending || !option || !branchId || !user?.id}
              style={[styles.cta, (initPurchase.isPending || !option || !branchId || !user?.id) && styles.ctaDisabled]}
              accessibilityRole="button"
            >
              <Text style={[styles.ctaText, { fontFamily: f700 }]}>{initPurchase.isPending ? t('packages.purchasing') : t('packages.purchase')}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>, themeColors: ReturnType<typeof useTheme>['theme']['colors']) => StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, paddingBottom: 120, gap: sawaaSpacing.md },
  header: { alignItems: 'center', gap: sawaaSpacing.md },
  backButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.teal[700], fontSize: 34, lineHeight: 34 },
  title: { flex: 1, color: colors.ink[900], fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  message: { color: colors.ink[500], textAlign: 'center', marginTop: sawaaSpacing['3xl'] },
  image: { width: '100%', height: 160, borderRadius: sawaaRadius.lg },
  familyName: { color: colors.ink[900], fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  description: { color: colors.ink[500], fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  sectionTitle: { color: colors.ink[900], fontSize: sawaaType.subheading.fontSize, marginTop: sawaaSpacing.md },
  option: { padding: sawaaSpacing.lg, minHeight: 80 },
  optionSelected: { borderWidth: 1, borderColor: colors.teal[500] },
  optionRow: { justifyContent: 'space-between', alignItems: 'center' },
  optionName: { color: colors.ink[900], fontSize: sawaaType.body.fontSize },
  optionPrice: { color: colors.teal[700], fontSize: sawaaType.body.fontSize },
  optionCount: { color: colors.ink[500], fontSize: sawaaType.caption.fontSize, marginTop: sawaaSpacing.xs },
  groupDetail: { borderTopWidth: 1, borderTopColor: colors.glass.borderSoft, marginTop: sawaaSpacing.sm, paddingTop: sawaaSpacing.sm, gap: sawaaSpacing.xs },
  groupLabel: { color: colors.ink[700], fontSize: sawaaType.caption.fontSize },
  groupMeta: { color: colors.ink[500], fontSize: sawaaType.micro.fontSize, lineHeight: sawaaType.micro.lineHeight },
  warning: { color: colors.accent.amber, fontSize: sawaaType.caption.fontSize },
  cta: { alignItems: 'center', backgroundColor: themeColors.primaryFill, borderRadius: sawaaRadius.md, padding: sawaaSpacing.lg, marginTop: sawaaSpacing.md },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { color: themeColors.primaryForeground, fontSize: sawaaType.body.fontSize },
});
