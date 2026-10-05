import { createHash } from 'node:crypto';
import type { NativePaymentCapabilities } from '@sawaa/shared/types';
export function nativePaymentConfigFingerprint(
  config: NativePaymentCapabilities & { publishableKey: string },
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        publishableKey: config.publishableKey,
        isLive: config.isLive,
        applePay: config.applePay,
      }),
    )
    .digest('hex');
}
