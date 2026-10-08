import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import type { NativePaymentConfiguration } from '@sawaa/shared';
import { ApplePayRequestSource, createPayment, isMoyasarError, PaymentRequest as MoyasarPaymentRequest } from 'react-native-moyasar-sdk';
// Metro resolves the public SDK to src; use that same graph to register PKPaymentButton once.
import { ApplePayButton, PaymentRequest, type ApplePayResponse } from 'react-native-moyasar-sdk/src/react_native_apple_pay';
import { canUseApplePay } from '@/modules/sawaa-payments';
import { useTheme } from '@/theme/ThemeProvider';
import { createNativePaymentConfig } from './native-payment-config';

export interface PreparedApplePay {
  config: NativePaymentConfiguration;
  onResult: () => void;
  onCancel?: () => void;
  isCurrent: () => boolean;
  /** Fresh server verdict after Wallet returns; the token is never submitted unless it resolves true. */
  verify: () => Promise<boolean>;
}

export function DeferredApplePayButton({ disabled, prepare, onError }: {
  disabled: boolean;
  prepare: () => Promise<PreparedApplePay | null>;
  onError: () => void;
}): React.JSX.Element {
  const { scheme } = useTheme();
  const { t } = useTranslation();
  const active = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function handlePress() {
    if (disabled || active.current) return;
    active.current = true;
    setBusy(true);
    try {
      let prepared: PreparedApplePay | null;
      try { prepared = await prepare(); }
      catch { onError(); return; }
      if (!prepared) return;
      if (!mounted.current || !prepared.isCurrent()) { prepared.onCancel?.(); return; }

      // Keep the callbacks returned for this attempt, even across parent renders.
      const { config, onResult, onCancel } = prepared;
      let response: ApplePayResponse;
      let paymentConfig: ReturnType<typeof createNativePaymentConfig>;
      try {
        paymentConfig = createNativePaymentConfig(config);
        if (!config.applePay || config.applePay.merchantId !== Constants.expoConfig?.extra?.applePayMerchantId
          || !canUseApplePay(config.supportedNetworks)) {
          onError(); return;
        }
        const request = new PaymentRequest([{
          supportedMethods: ['apple-pay'],
          data: { merchantIdentifier: config.applePay.merchantId,
            supportedNetworks: paymentConfig.supportedNetworks,
            countryCode: paymentConfig.merchantCountryCode, currencyCode: paymentConfig.currency },
        }], { total: { label: config.applePay.label,
          amount: { currency: paymentConfig.currency, value: (paymentConfig.amount / 100).toFixed(2) } } });
        response = await request.show();
      } catch (error) {
        // SDK 0.15 uses Error('AbortError'); DOM-style bridges may use name.
        if (error instanceof Error && (error.name === 'AbortError' || error.message === 'AbortError')) onCancel?.();
        else onError();
        return;
      }

      if (!mounted.current || !prepared.isCurrent()) {
        try { await response.complete('failure'); } catch { /* Owner revoked; never submit its token. */ }
        onCancel?.(); return;
      }
      let payable = false;
      try { payable = await prepared.verify(); } catch { /* Unknown eligibility is treated as not payable. */ }
      if (!payable || !mounted.current || !prepared.isCurrent()) {
        try { await response.complete('failure'); } catch { /* No token was submitted. */ }
        onCancel?.(); return;
      }
      const token = response.details.paymentData;
      if (!token) {
        try { await response.complete('failure'); } catch { /* Completion cannot create a provider outcome. */ }
        onError(); return;
      }
      let completion: 'success' | 'failure' = 'failure';
      try {
        const source = new ApplePayRequestSource({
          // The bundled bridge returns JSON data; SDK 0.15 forwards it unchanged
          // despite declaring this constructor parameter as string.
          applePayToken: token as string,
          manualPayment: paymentConfig.applePay?.manual, saveCard: paymentConfig.applePay?.saveCard,
        });
        const result = await createPayment(new MoyasarPaymentRequest({
          givenId: paymentConfig.givenId, baseUrl: paymentConfig.baseUrl,
          amount: paymentConfig.amount, currency: paymentConfig.currency,
          description: paymentConfig.description, metadata: paymentConfig.metadata,
          source, applyCoupon: paymentConfig.applyCoupon, splits: paymentConfig.splits,
        }), paymentConfig.publishableApiKey);
        if (!isMoyasarError(result) && result.status === 'paid') completion = 'success';
      } catch { /* A failure after token submission is ambiguous: reconcile the same server UUID. */ }
      try { await response.complete(completion); } catch { /* Server reconciliation still owns the outcome. */ }
      onResult();
    } finally {
      active.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const locked = disabled || busy;
  return <View accessible accessibilityRole="button" accessibilityLabel={t('nativePayment.useApplePay')}
    accessibilityState={{ disabled: locked, busy }} pointerEvents={locked ? 'none' : 'auto'}
    onAccessibilityTap={() => { void handlePress(); }} style={{ width: '100%', height: 50 }}>
    <ApplePayButton type="inStore" style={scheme === 'dark' ? 'white' : 'black'}
      width="100%" height={50} cornerRadius={11} onPress={() => { void handlePress(); }} />
  </View>;
}
