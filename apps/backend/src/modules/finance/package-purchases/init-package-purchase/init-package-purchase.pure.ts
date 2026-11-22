import { ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';

import type { InitPackagePurchaseCommand } from './init-package-purchase.types';

/**
 * Pure helpers for the self-purchase checkout: URL building, status
 * classification and amount matching. Extracted from
 * `init-package-purchase.handler.ts` (MNT-18) so the handler keeps the
 * transaction and the query sequence while these stay unit-testable without a
 * database.
 *
 * Behaviour is unchanged: same URL shape, same status lists, same comparison.
 */

/** Payment-callback URL handed to the gateway. */
export function buildPackagePurchaseCallbackUrl(purchaseId: string, invoiceId: string): string {
  const baseUrl = process.env['PUBLIC_WEBSITE_URL'] || 'http://localhost:3000';
  return `${baseUrl}/packages/payment-callback?purchaseId=${purchaseId}&invoiceId=${invoiceId}`;
}

/** Hosted-invoice statuses that mean the money moved. */
export function isPaidCheckoutStatus(status: string): boolean {
  return ['paid', 'completed'].includes(status.toLowerCase());
}

/** Hosted-invoice statuses that mean the attempt is dead and can be replaced. */
export function isTerminalFailedCheckoutStatus(status: string): boolean {
  return ['expired', 'failed', 'canceled', 'cancelled', 'voided', 'refunded'].includes(status.toLowerCase());
}

/**
 * Reject a hosted invoice whose amount or currency does not match the attempt
 * we are reconciling. Amounts are integer halalas on both sides.
 */
export function assertHostedInvoiceMatches(
  checkout: { amount: number; currency: string },
  amountHalalas: number,
  currency: string,
): void {
  if (
    Math.round(checkout.amount) !== amountHalalas ||
    checkout.currency.toUpperCase() !== currency.toUpperCase()
  ) {
    throw new ConflictException('Hosted invoice does not match the package payment attempt');
  }
}

export function selfPurchaseFingerprint(
  cmd: InitPackagePurchaseCommand,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        source: "self-purchase",
        clientId: cmd.clientId,
        packageId: cmd.packageId,
        branchId: cmd.branchId,
        ...(cmd.packageFamilyId ? { packageFamilyId: cmd.packageFamilyId } : {}),
      }),
    )
    .digest("hex");
}
