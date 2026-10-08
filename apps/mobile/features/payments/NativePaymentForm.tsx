import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { canUseApplePay } from '@/modules/sawaa-payments';
import { ApplePay, CreditCard } from 'react-native-moyasar-sdk';
import type { NativePaymentConfiguration, NativePaymentMethod } from '@sawaa/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getSawaaRoles } from '@/theme/sawaa/tokens';
import { createNativePaymentConfig } from './native-payment-config';

export type SdkOutcome = 'submitted' | 'rejected';

/**
 * Only a validation rejection from Moyasar (HTTP error with type invalid_request_error) happens
 * before any payment exists. Everything else, including transport errors and failed payments, is
 * ambiguous and stays verification-only; the payload itself is never retained.
 */
function classifySdkResult(result: unknown): SdkOutcome {
  const value = result as { name?: unknown; error?: { type?: unknown } } | null | undefined;
  return value?.name === 'MoyasarNetworkEndpointError' && value.error?.type === 'invalid_request_error'
    ? 'rejected' : 'submitted';
}

interface Props {
  config: NativePaymentConfiguration;
  method: NativePaymentMethod;
  applePayAvailable: boolean;
  onResult: (outcome: SdkOutcome) => void;
  onSelectCard?: () => void;
}

export function NativePaymentForm({ config, method, applePayAvailable, onResult, onSelectCard }: Props) {
  const paymentConfig = useMemo(() => createNativePaymentConfig(config), [config]);
  const { scheme } = useTheme();
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? i18n.language).startsWith('ar') ? 'ar' : 'en';
  const colors = useSawaaColors();
  const action = getSawaaRoles(scheme).action;
  // Server reconciliation owns the outcome; the SDK payload is only classified, never stored.
  const resultReceived = (result: unknown) => onResult(classifySdkResult(result));
  const appleReady = applePayAvailable && config.applePay
    && config.applePay.merchantId === Constants.expoConfig?.extra?.applePayMerchantId
    && canUseApplePay(config.supportedNetworks);
  if (method === 'APPLE_PAY' && !appleReady) {
    return <View>
      <Text style={{ color: colors.ink[900] }}>{t('nativePayment.appleUnavailable')}</Text>
      {onSelectCard ? <Pressable accessibilityRole="button" onPress={onSelectCard}>
        <Text style={{ color: colors.ink[900] }}>{t('nativePayment.useCard')}</Text>
      </Pressable> : null}
    </View>;
  }
  if (method === 'APPLE_PAY') {
    return <ApplePay paymentConfig={paymentConfig} onPaymentResult={resultReceived}
      style={{ buttonType: 'buy', buttonStyle: scheme === 'dark' ? 'white' : 'black', width: '100%', height: 50 }} />;
  }
  return <CreditCard language={language} paymentConfig={paymentConfig} onPaymentResult={resultReceived}
    style={{ textInputs: { color: colors.ink[900] }, textInputsPlaceholderColor: colors.ink[500],
      paymentButton: { backgroundColor: action.fill, height: 'auto', minHeight: 50 }, paymentButtonText: { color: action.foreground },
      activityIndicatorColor: colors.teal[600], webviewActivityIndicatorColor: colors.teal[600] }} />;
}
