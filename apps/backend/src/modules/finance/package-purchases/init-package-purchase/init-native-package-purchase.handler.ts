import { Injectable } from '@nestjs/common';
import type { NativePackagePurchaseInitResponse } from '@sawaa/shared/types';
import {
  InitPackagePurchaseHandler,
  InitPackagePurchaseCommand,
} from './init-package-purchase.handler';
import { GetNativePaymentConfigHandler } from '../../native-payments/get-native-payment-config/get-native-payment-config.handler';
import { nativePaymentConfigFingerprint } from '../../native-payments/native-payment-config-fingerprint';
@Injectable()
export class InitNativePackagePurchaseHandler {
  constructor(
    private readonly purchases: InitPackagePurchaseHandler,
    private readonly configurations: GetNativePaymentConfigHandler,
  ) {}
  async execute(
    cmd: InitPackagePurchaseCommand,
  ): Promise<NativePackagePurchaseInitResponse> {
    const config = await this.configurations.getPaymentConfiguration();
    return this.purchases.execute(cmd, {
      mode: 'NATIVE',
      fingerprint: nativePaymentConfigFingerprint(config),
    });
  }
}
