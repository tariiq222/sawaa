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
    origin?: string;
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
  const userRef = useRef(userId);
  userRef.current = userId;
  const purchaseId = params.purchaseId;
  const belongsToUser = Boolean(userId && (!params.clientId || params.clientId === userId));
  const tryingAgainRef = useRef(false);
  const [signal] = useState<PackageCheckoutSignal>(() => initialSignal(params.signal, params.status));
  const [pendingPolls, setPendingPolls] = useState(0);
  const [tryingAgain, setTryingAgain] = useState(false);
  const lastCountedUpdate = useRef(0);
  const [polling, setPolling] = useState(true);
  const query = usePackagePurchase(belongsToUser ? purchaseId : undefined, { poll: belongsToUser && polling });
  const { refetch } = query;
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const paymentState = packagePaymentState(belongsToUser ? query.data?.status : undefined, query.isLoading, { signal, pendingPolls });
  const paymentError = !belongsToUser || !purchaseId || (query.isError && paymentState !== 'failed');
  const targetMatches = Boolean(query.data && query.data.id === purchaseId
    && query.data.packageId === params.packageId && query.data.branchId === params.branchId
    && (query.data.packageFamilyId ?? '') === (params.familyId ?? ''));
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
      if (belongsToUser) void refetch();
    }, [belongsToUser, refetch]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && belongsToUser) void refetch();
    });
    return () => subscription.remove();
  }, [belongsToUser, refetch]);

  useEffect(() => {
    if (!paid || !belongsToUser || !params.clientId || !params.packageId || !params.branchId
      || query.data?.id !== purchaseId || query.data.packageId !== params.packageId
      || query.data.branchId !== params.branchId || (query.data.packageFamilyId ?? '') !== (params.familyId ?? '')) return;
    void clearPackagePurchaseAttemptKey(
      params.clientId,
      params.packageId,
      params.familyId || undefined,
      params.branchId,
    );
    void clearPendingPackagePurchase({ clientId: params.clientId, purchaseId: purchaseId! });
  }, [belongsToUser, paid, params.branchId, params.clientId, params.familyId, params.packageId, purchaseId, query.data]);

  // A declined, abandoned, or unconfirmed checkout must not keep sending the
  // client back here from the package screen. The attempt key is kept so a
  // retry resumes the same purchase instead of being rejected as a duplicate.
  useEffect(() => {
    if (stopped && belongsToUser && userId && purchaseId && params.origin !== 'native') {
      void clearPendingPackagePurchase({ clientId: userId, purchaseId });
    }
  }, [belongsToUser, params.origin, purchaseId, stopped, userId]);

  const checkAgain = useCallback(() => {
    lastCountedUpdate.current = 0;
    setPendingPolls(0);
    if (belongsToUser) void refetch();
  }, [belongsToUser, refetch]);

  const canRetryPayment = Boolean(targetMatches && params.clientId && params.packageId && params.branchId && params.clientId === userId);

  const tryAgain = useCallback(async () => {
    if (!canRetryPayment || !params.clientId || !params.packageId || !params.branchId || tryingAgainRef.current) return;
    tryingAgainRef.current = true;
    setTryingAgain(true);
    try {
      const result = await runPackageCheckout(initPurchase.mutateAsync, {
        clientId: params.clientId,
        packageId: params.packageId,
        familyId: params.familyId ?? '',
        branchId: params.branchId,
      });
      if (userRef.current !== params.clientId) return;
      router.replace({ pathname: '/(client)/payments/native-checkout', params: {
        purchaseId: result.purchaseId, invoiceId: result.invoiceId,
      } });
    } catch (error) {
      Alert.alert(t('packages.errorTitle'), t(packagePurchaseErrorKey(error)));
    } finally {
      tryingAgainRef.current = false;
      setTryingAgain(false);
    }
  }, [canRetryPayment, initPurchase.mutateAsync, params.branchId, params.clientId, params.familyId, params.packageId, router, t]);

  return (
    <AquaBackground>
      <View style={[styles.content, { paddingTop: insets.top + sawaaSpacing['3xl'] }]}>
        <PackagePaymentStatus
          state={paymentState}
          error={paymentError}
          onBack={() => router.replace('/(client)/packages/purchases')}
          onRetry={belongsToUser && purchaseId ? checkAgain : undefined}
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
