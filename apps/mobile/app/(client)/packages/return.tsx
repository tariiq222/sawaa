import React, { useCallback, useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AquaBackground, sawaaSpacing } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { usePackagePurchase } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';
import { clearPackagePurchaseAttemptKey, clearPendingPackagePurchase } from '@/services/client/packages';
import { packagePaymentState } from '@/lib/package-utils';
import { PackagePaymentStatus } from '@/components/features/packages/PackagePaymentStatus';

export default function PackagePaymentReturnScreen() {
  const params = useLocalSearchParams<{
    purchaseId?: string;
    clientId?: string;
    packageId?: string;
    familyId?: string;
    branchId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const query = usePackagePurchase(params.purchaseId);
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const paymentState = packagePaymentState(query.data?.status, query.isLoading);
  const paymentError = !params.purchaseId || query.isError;
  const paid = !paymentError && paymentState === 'success';

  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void query.refetch();
    });
    return () => subscription.remove();
  }, [query.refetch]);

  useEffect(() => {
    if (!paid || !params.clientId || !params.packageId || !params.branchId) return;
    void clearPackagePurchaseAttemptKey(
      params.clientId,
      params.packageId,
      params.familyId || undefined,
      params.branchId,
    );
    void clearPendingPackagePurchase();
  }, [paid, params.branchId, params.clientId, params.familyId, params.packageId]);

  return (
    <AquaBackground>
      <View style={[styles.content, { paddingTop: insets.top + sawaaSpacing['3xl'] }]}>
        <PackagePaymentStatus
          state={paymentState}
          error={paymentError}
          onBack={() => router.replace('/(client)/packages/purchases')}
          onRetry={params.purchaseId ? () => { void query.refetch(); } : undefined}
          dir={dir}
          f400={f400}
          f600={f600}
          f700={f700}
        />
      </View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: sawaaSpacing['2xl'], alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.lg },
});
