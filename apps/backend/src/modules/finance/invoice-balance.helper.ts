import { PaymentStatus } from '@prisma/client';

/** Settlement remains historical fact after a partial or full refund. */
export const SETTLED_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED,
];

export interface InvoiceBalanceInput {
  /** Stored invoice total after its historical discount and VAT, in halalas. */
  invoiceTotal: number;
  /** Original amounts of successfully settled payments, including refunded rows. */
  grossSettled: number;
  /** Completed refunds counted once, not again through RefundRequest totals. */
  refundedSettled: number;
  /** Active reservations excluding the payment currently being settled. */
  reservedPending: number;
  /** Explicit caller policy; an arithmetic outstanding balance is not permission. */
  newCollectionBlocked: boolean;
}

export interface InvoiceBalance {
  netSettled: number;
  outstanding: number;
  availableToCollect: number;
  overCollected: number;
}

/** Callers must surface this for reconciliation; it must never authorize a charge. */
export class InvoiceBalanceMismatchError extends RangeError {
  constructor() {
    super('Completed refunds exceed gross settled payments');
    this.name = 'InvoiceBalanceMismatchError';
  }
}

/**
 * Pure whole-halala accounting. Convert selected Decimal values with the
 * existing decimalToHalalas helper before supplying these aggregates.
 * No policy default, persistence, provider call, or historical normalization.
 */
export function calculateInvoiceBalance(input: InvoiceBalanceInput): InvoiceBalance {
  for (const key of ['invoiceTotal', 'grossSettled', 'refundedSettled', 'reservedPending'] as const) {
    const amount = input[key];
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new RangeError(`${key} must be a non-negative safe integer halala amount`);
    }
  }
  if (typeof input.newCollectionBlocked !== 'boolean') {
    throw new TypeError('newCollectionBlocked must be an explicit boolean');
  }
  if (input.refundedSettled > input.grossSettled) {
    throw new InvoiceBalanceMismatchError();
  }

  const netSettled = input.grossSettled - input.refundedSettled;
  const outstanding = Math.max(0, input.invoiceTotal - netSettled);
  return {
    netSettled,
    outstanding,
    availableToCollect: input.newCollectionBlocked
      ? 0 : Math.max(0, outstanding - input.reservedPending),
    overCollected: Math.max(0, netSettled - input.invoiceTotal),
  };
}
