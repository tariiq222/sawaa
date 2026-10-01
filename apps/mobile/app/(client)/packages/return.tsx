import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AquaBackground, sawaaSpacing } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { useInitPackagePurchase, usePackagePurchase } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';
import { clearPackagePurchaseAttemptKey, clearPendingPackagePurchase } from '@/services/client/packages';
import {
  packageCheckoutSignalFromRedirect,
  packagePaymentState,
  packagePurchaseErrorKey,
  type PackageCheckoutSignal,
} from '@/lib/package-utils';
import { runPackageCheckout } from '@/lib/package-checkout';
import { PackagePaymentStatus } from '@/components/features/packages/PackagePaymentStatus';

const CHECKOUT_SIGNALS: readonly PackageCheckoutSignal[] = ['failed', 'closed', 'paid', 'unknown'];

function initialSignal(signal: string | undefined, gatewayStatus: string | undefined): PackageCheckoutSignal {
  // Moyasar's own redirect status (deep link) wins over the in-app hint.
  const fromGateway = packageCheckoutSignalFromRedirect(gatewayStatus);
  if (fromGateway !== 'unknown') return fromGateway;
  return CHECKOUT_SIGNALS.find((candidate) => candidate === signal) ?? 'unknown';
}

export default function PackagePaymentReturnScreen() {
  const params = useLocalSearchParams<{
    purchaseId?: string;
    clientId?: string;
    packageId?: string;
    familyId?: string;
    branchId?: string;
    /** In-app checkout signal set by the purchase screen. */
    signal?: string;
    /** Moyasar redirect parameters, when the gateway redirect reaches the app. */
    status?: string;
    message?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const userId = useAppSelector((state) => state.auth.user?.id);
  const initPurchase = useInitPackagePurchase();
  const [purchaseId, setPurchaseId] = useState(params.purchaseId);
  const [signal, setSignal] = useState<PackageCheckoutSignal>(() => initialSignal(params.signal, params.status));
  const [pendingPolls, setPendingPolls] = useState(0);
  const [tryingAgain, setTryingAgain] = useState(false);
  const lastCountedUpdate = useRef(0);
  const [polling, setPolling] = useState(true);
  const query = usePackagePurchase(purchaseId, { poll: polling });
  const { refetch } = query;
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const paymentState = packagePaymentState(query.data?.status, query.isLoading, { signal, pendingPolls });
  const paymentError = !purchaseId || (query.isError && paymentState !== 'failed');
  const paid = !paymentError && paymentState === 'success';
  const stopped = !paymentError && (paymentState === 'failed' || paymentState === 'unconfirmed');

  // Count each fresh still-PENDING read so polling stops after a bounded window.
  useEffect(() => {
    if (query.data?.status !== 'PENDING' || !query.dataUpdatedAt) return;
    if (query.dataUpdatedAt === lastCountedUpdate.current) return;
    lastCountedUpdate.current = query.dataUpdatedAt;
    setPendingPolls((count) => count + 1);
  }, [query.data?.status, query.dataUpdatedAt]);

  useEffect(() => {
    setPolling(paymentState === 'pending');
  }, [paymentState]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

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

  // A declined, abandoned, or unconfirmed checkout must not keep sending the
  // client back here from the package screen. The attempt key is kept so a
  // retry resumes the same purchase instead of being rejected as a duplicate.
  useEffect(() => {
    if (stopped) void clearPendingPackagePurchase();
  }, [stopped]);

  const checkAgain = useCallback(() => {
    lastCountedUpdate.current = 0;
    setPendingPolls(0);
    void refetch();
  }, [refetch]);

  const canRetryPayment = Boolean(params.clientId && params.packageId && params.branchId && params.clientId === userId);

  const tryAgain = useCallback(async () => {
    if (!params.clientId || !params.packageId || !params.branchId || tryingAgain) return;
    setTryingAgain(true);
    try {
      const result = await runPackageCheckout(initPurchase.mutateAsync, {
        clientId: params.clientId,
        packageId: params.packageId,
        familyId: params.familyId ?? '',
        branchId: params.branchId,
      });
      lastCountedUpdate.current = 0;
      setPendingPolls(0);
      setSignal(result.signal);
      setPurchaseId(result.purchaseId);
      if (result.purchaseId === purchaseId) void refetch();
    } catch (error) {
      Alert.alert(t('packages.errorTitle'), t(packagePurchaseErrorKey(error)));
    } finally {
      setTryingAgain(false);
    }
  }, [initPurchase.mutateAsync, params.branchId, params.clientId, params.familyId, params.packageId, purchaseId, refetch, t, tryingAgain]);

  return (
    <AquaBackground>
      <View style={[styles.content, { paddingTop: insets.top + sawaaSpacing['3xl'] }]}>
        <PackagePaymentStatus
          state={paymentState}
          error={paymentError}
          onBack={() => router.replace('/(client)/packages/purchases')}
          onRetry={purchaseId ? checkAgain : undefined}
          onTryAgain={canRetryPayment ? () => { void tryAgain(); } : undefined}
          tryingAgain={tryingAgain}
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
