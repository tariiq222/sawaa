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

interface Props {
  config: NativePaymentConfiguration;
  method: NativePaymentMethod;
  applePayAvailable: boolean;
  onResult: () => void;
  onSelectCard?: () => void;
}

export function NativePaymentForm({ config, method, applePayAvailable, onResult, onSelectCard }: Props) {
  const paymentConfig = useMemo(() => createNativePaymentConfig(config), [config]);
  const { scheme } = useTheme();
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? i18n.language).startsWith('ar') ? 'ar' : 'en';
  const colors = useSawaaColors();
  const action = getSawaaRoles(scheme).action;
  // Deliberately discard the SDK payload: server reconciliation owns the outcome.
  const resultReceived = () => onResult();
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
