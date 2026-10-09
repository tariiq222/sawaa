import type { NativePaymentMethod } from '@sawaa/shared';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '@/hooks/use-redux';
import { useTheme } from '@/theme/ThemeProvider';
import { AquaBackground } from '@/theme/sawaa/AquaBackground';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getSawaaRoles, sawaaRadius, sawaaSpacing } from '@/theme/sawaa/tokens';
import { AppButton } from '@/components/ui/AppButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ThemedText } from '@/theme/components/ThemedText';
import { goBackOrHome } from '@/lib/navigation';
import { useDir } from '@/hooks/useDir';
import { NativePaymentForm } from '@/features/payments/NativePaymentForm';
import { useNativePaymentCheckout } from '@/features/payments/use-native-payment-checkout';
import { useNativePaymentCapabilities } from '@/features/payments/native-payment-capabilities';
import { getPendingPackagePurchase } from '@/services/client/packages';
import { useBooking, usePublicCatalog } from '@/hooks/queries';
import { resolveConfirmCatalogSelection } from '@/features/booking/confirm-catalog';
import { mapCatalogDepartments } from '@/services/client/catalog';

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export default function NativeCheckout() {
  const params = useLocalSearchParams<{ invoiceId?: string; bookingId?: string; purchaseId?: string; method?: string; fromBookingConfirm?: string; clinicId?: string }>();
  const invoiceId = single(params.invoiceId) ?? '';
  const bookingId = single(params.bookingId);
  const purchaseId = single(params.purchaseId);
  const fromBookingConfirm = single(params.fromBookingConfirm) === 'true';
  const clientId = useAppSelector((state) => state.auth.user?.id);
  const capabilities = useNativePaymentCapabilities();
  const choiceScope = JSON.stringify([clientId, invoiceId, bookingId, purchaseId, params.method]);
  const currentChoiceScope = useRef(choiceScope); currentChoiceScope.current = choiceScope;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [choice, setChoice] = useState<{ scope: string; method: NativePaymentMethod } | null>(null);
  const retryChoice = useRef<{ scope: string; method: NativePaymentMethod } | null>(null);
  const [cardRejected, setCardRejected] = useState(false);
  const [availabilityRequestScope, setAvailabilityRequestScope] = useState<string | null>(null);
  const reviewingAvailability = availabilityRequestScope === choiceScope;
  const [availabilityErrorScope, setAvailabilityErrorScope] = useState<string | null>(null);
  const explicitMethod = params.method === 'APPLE_PAY' || params.method === 'ONLINE_CARD' ? params.method : undefined;
  const method = (choice?.scope === choiceScope ? choice.method : explicitMethod)
    ?? (!capabilities.isLoading && !capabilities.applePayAvailable ? 'ONLINE_CARD' : undefined);
  // Keep a resolved method stable if capabilities refresh while a bank challenge is open.
  useEffect(() => {
    setChoice((previous) => previous?.scope === choiceScope ? previous
      : method ? { scope: choiceScope, method } : null);
  }, [choiceScope, method]);
  const selectMethod = (selected: NativePaymentMethod) => setChoice({ scope: choiceScope, method: selected });
  const appleUnavailable = method === 'APPLE_PAY' && !capabilities.isLoading && !capabilities.applePayAvailable;
  const checkout = useNativePaymentCheckout({
    clientId: capabilities.isLoading || capabilities.isError || !capabilities.enabled || appleUnavailable ? undefined : clientId,
    invoiceId, bookingId, purchaseId, method,
  });
  const { phase, canRetryInit, retryInitialization } = checkout;
  const expiredBooking = useBooking(clientId && phase === 'unavailable' && checkout.unavailableReason === 'BOOKING_EXPIRED' ? bookingId : undefined);
  const recoveryCatalog = usePublicCatalog(false);
  // Restore and verify the old UUID after a method change before initializing a new attempt.
  useEffect(() => {
    const requested = retryChoice.current;
    if (!requested || requested.scope !== choiceScope || requested.method !== method) return;
    if (['completed', 'review', 'unavailable'].includes(phase)) { retryChoice.current = null; return; }
    if (phase === 'failed' && canRetryInit) {
      retryChoice.current = null;
      void retryInitialization();
    }
  }, [choiceScope, method, phase, canRetryInit, retryInitialization]);
  const retryWithMethod = (selected: NativePaymentMethod) => {
    if (checkout.phase !== 'failed' || !checkout.canRetryInit) return;
    if (selected === method) { void checkout.retryInitialization(); return; }
    retryChoice.current = { scope: choiceScope, method: selected };
    selectMethod(selected);
  };
  useEffect(() => { setCardRejected(false); }, [choiceScope, checkout.attempt]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const colors = useSawaaColors();
  const dir = useDir();
  const { scheme } = useTheme();
  const roles = getSawaaRoles(scheme);
  const reviewAvailability = async () => {
    if (!bookingId || !clientId || reviewingAvailability) return;
    const requestedScope = choiceScope;
    const owned = () => mounted.current && currentChoiceScope.current === requestedScope;
    setAvailabilityRequestScope(requestedScope); setAvailabilityErrorScope(null);
    try {
      const [result, catalog] = await Promise.all([expiredBooking.refetch(), recoveryCatalog.refetch()]);
      const booking = result.data;
      if (!owned()) return;
      if (result.isError || !booking || booking.id !== bookingId || booking.invoiceId !== invoiceId || !booking.serviceId || !booking.employeeId || !booking.branchId) throw new Error('Booking context unavailable');
      if (catalog.isError || !catalog.data) throw new Error('Catalog unavailable');
      const service = catalog.data.services.find((item) => item.id === booking.serviceId);
      const category = catalog.data.categories.find((item) => item.id === service?.categoryId);
      const clinicId = single(params.clinicId) ?? ((category?.kind ?? 'CLINIC') === 'CLINIC' ? category?.id : undefined);
      if (!resolveConfirmCatalogSelection(catalog.data, mapCatalogDepartments(catalog.data), clinicId, booking.serviceId).service) throw new Error('Clinic context unavailable');
      router.replace({ pathname: '/(client)/booking/[serviceId]', params: {
        serviceId: booking.serviceId, employeeId: booking.employeeId, branchId: booking.branchId,
        ...(clinicId ? { clinicId } : {}),
      } });
    } catch { if (owned()) setAvailabilityErrorScope(requestedScope); }
    finally { if (owned()) setAvailabilityRequestScope(null); }
  };
  const navigationScope = useRef(clientId);
  navigationScope.current = clientId;
  useEffect(() => {
    if (checkout.phase !== 'completed' || !clientId || !checkout.paymentId) return;
    let active = true;
    if (bookingId) {
      // Pending Back retains confirmation; completion replaces that retained screen.
      if (fromBookingConfirm) router.dismiss(1);
      router.replace({ pathname: '/(client)/booking/success', params: { invoiceId, bookingId, paymentId: checkout.paymentId, webResult: 'native' } });
    }
    else if (purchaseId) {
      void getPendingPackagePurchase(clientId).then((pending) => {
        if (!active || navigationScope.current !== clientId) return;
        const matching = pending?.clientId === clientId && pending.purchaseId === purchaseId ? pending : undefined;
        router.replace({ pathname: '/(client)/packages/return', params: {
          purchaseId, clientId, origin: 'native',
          ...(matching ? { packageId: matching.packageId, familyId: matching.familyId, branchId: matching.branchId } : {}),
        } });
      }).catch(() => {
        if (active && navigationScope.current === clientId) router.replace('/(client)/packages/purchases');
      });
    }
    return () => { active = false; };
  }, [checkout.phase, checkout.paymentId, clientId, invoiceId, bookingId, purchaseId, fromBookingConfirm, router]);
  const loading = capabilities.isLoading || (!appleUnavailable && (checkout.phase === 'loading' || checkout.phase === 'checking' || checkout.phase === 'processing'));
  const unavailable = capabilities.isError || !capabilities.enabled || !clientId;
  const terminalUnavailable = checkout.phase === 'unavailable';
  const choosing = !method && !unavailable && (checkout.phase === 'choosing' || (checkout.canResume && !checkout.config));
  const statusKey = terminalUnavailable ? `nativePayment.${checkout.unavailableReason}` : choosing ? 'nativePayment.choosing' : unavailable ? 'nativePayment.unavailable' : appleUnavailable ? 'nativePayment.appleUnavailable'
    : checkout.error ?? (checkout.phase === 'pending' && !checkout.config && !checkout.canResume ? 'nativePayment.awaitingVerification' : `nativePayment.${checkout.phase}`);
  return (
    <AquaBackground>
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + sawaaSpacing['2xl'], paddingBottom: insets.bottom + sawaaSpacing['2xl'] }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t('nativePayment.title') }} />
      <ScreenHeader title={t('nativePayment.title')} onBack={() => goBackOrHome(router, '/(client)/(tabs)/home')} />
      {loading && !unavailable ? <ActivityIndicator color={colors.teal[600]} /> : null}
      <ThemedText variant="body" align={dir.textAlign} accessibilityLiveRegion="polite">{t(statusKey)}</ThemedText>
      {choosing ? <View style={styles.form}>
        <AppButton variant="secondary" onPress={() => selectMethod('APPLE_PAY')} label={t('nativePayment.useApplePay')} />
        <AppButton variant="secondary" onPress={() => selectMethod('ONLINE_CARD')} label={t('nativePayment.useCard')} />
      </View> : null}
      {['ready', 'checking', 'pending', 'error'].includes(checkout.phase) && checkout.config && method && !unavailable && !appleUnavailable ? <View style={[styles.form, { backgroundColor: roles.surface }]}>
        <ThemedText variant="bodySm" align={dir.textAlign}>{t('nativePayment.cardNetworks')}</ThemedText>
        {cardRejected ? <ThemedText variant="bodySm" align={dir.textAlign} accessibilityLiveRegion="polite">{t('nativePayment.cardRejected')}</ThemedText> : null}
        <NativePaymentForm config={checkout.config} method={method} applePayAvailable={capabilities.applePayAvailable}
          onResult={(outcome) => {
            // A definitive pre-creation rejection leaves the same form and attempt usable.
            if (outcome === 'rejected') { setCardRejected(true); return; }
            setCardRejected(false);
            void checkout.onPaymentResult();
          }} onSelectCard={() => selectMethod('ONLINE_CARD')} />
      </View> : null}
      {appleUnavailable && !unavailable && !checkout.paymentId ? <AppButton variant="secondary" onPress={() => selectMethod('ONLINE_CARD')} label={t('nativePayment.useCard')} /> : null}
      {checkout.phase === 'failed' && checkout.canRetryInit && !loading && !unavailable ? <View style={styles.form}>
        {capabilities.applePayAvailable ? <AppButton variant="secondary" onPress={() => retryWithMethod('APPLE_PAY')} label={t('nativePayment.retryApplePay')} /> : null}
        <AppButton variant="secondary" onPress={() => retryWithMethod('ONLINE_CARD')} label={t('nativePayment.useAnotherCard')} />
      </View> : null}
      {terminalUnavailable && checkout.unavailableReason === 'BOOKING_EXPIRED' && bookingId ? <AppButton variant="secondary" onPress={() => { void reviewAvailability(); }} loading={reviewingAvailability} label={t('nativePayment.reviewAvailability')} /> : null}
      {availabilityErrorScope === choiceScope ? <ThemedText accessibilityLiveRegion="polite">{t('nativePayment.verificationError')}</ThemedText> : null}
      {checkout.paymentId && !loading && !['completed', 'review', 'unavailable', 'failed'].includes(checkout.phase) && !choosing ? <AppButton onPress={() => { void checkout.reconcile(); }} label={t('nativePayment.checkAgain')} loading={loading} /> : null}
      {!loading && !unavailable && !appleUnavailable && !choosing && !checkout.config && checkout.canRetryInit
        && (checkout.canResume || !checkout.paymentId) && ['pending', 'error'].includes(checkout.phase) ? <AppButton variant="secondary" onPress={() => { void checkout.retryInitialization(); }} label={t('nativePayment.resume')} /> : null}
      {unavailable && !terminalUnavailable ? <AppButton variant="secondary" onPress={capabilities.refetch} label={t('nativePayment.retry')} /> : null}
      <AppButton variant="secondary" onPress={() => goBackOrHome(router, '/(client)/(tabs)/home')} label={t('nativePayment.back')} />
    </ScrollView>
    </AquaBackground>
  );
}
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: sawaaSpacing['2xl'], gap: sawaaSpacing.lg },
  form: { gap: sawaaSpacing.lg, padding: sawaaSpacing.lg, borderRadius: sawaaRadius.md },
});
