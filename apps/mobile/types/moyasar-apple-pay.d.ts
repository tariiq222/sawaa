// Local types for the private Apple Pay bridge bundled with pinned SDK 0.15.
declare module 'react-native-moyasar-sdk/src/react_native_apple_pay' {
  export const ApplePayButton: import('react').ComponentType<{
    type: 'plain' | 'buy' | 'setUp' | 'inStore' | 'donate';
    style: 'white' | 'whiteOutline' | 'black';
    width: number | `${number}%`;
    height: number;
    cornerRadius: number;
    onPress: () => void;
  }>;

  export interface ApplePayResponse {
    details: { paymentData: string | Record<string, unknown> | null };
    complete: (status: 'success' | 'failure') => Promise<void>;
  }

  export class PaymentRequest {
    constructor(methods: Array<{
      supportedMethods: ['apple-pay'];
      data: { merchantIdentifier: string; supportedNetworks: string[]; countryCode: string; currencyCode: string };
    }>, details: { total: { label: string; amount: { currency: string; value: string } } });
    show(): Promise<ApplePayResponse>;
  }
}
