import { ConflictException, Logger } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../../../infrastructure/database';
import { MoyasarApiClient } from '../../../moyasar-api/moyasar-api.client';
import { DEFAULT_ORG_ID } from '../../../../../common/constants';
import { isNonPayableInvoiceStatus } from '../../../invoice-payment-state.helper';

/**
 * Minimal shape of the existing PENDING payment row a caller has already loaded
 * by its `@unique` idempotencyKey. Only the fields the reconciliation needs.
 */
export interface InFlightPaymentRow {
  id: string;
  gatewayRef: string | null;
}

export interface ReplaceablePaymentRow extends InFlightPaymentRow {
  status: PaymentStatus;
}

/**
 * Caller-supplied, context-specific messages so the same logic can serve both
 * the per-invoice client payment and the package self-purchase without drift.
 */
export interface ReconcileMessages {
  /** Thrown when the gateway reports the session as already paid/captured/authorized. */
  alreadyPaid: string;
  /** Thrown when the gateway reports the session as still `initiated` (live). */
  inFlight: string;
}

const TERMINAL_PAID_STATUSES: readonly string[] = ['paid', 'captured', 'authorized'];
const TERMINAL_FAILED_STATUSES: readonly string[] = ['failed', 'voided', 'refunded'];

/**
 * G3 reconciliation (P1-7 mitigation), shared verbatim by InitClientPaymentHandler
 * and InitPackagePurchaseHandler — a single source of truth prevents the two
 * copies from drifting (a drift = double charge).
 *
 * Given an existing non-completed payment row (looked up by its `@unique`
 * idempotencyKey, so at most one row exists — this also guards concurrent inits):
 *
 *   - If the row carries a `gatewayRef`, a live Moyasar session may already
 *     exist. Reconcile against the gateway BEFORE discarding. Deleting it blind
 *     (the old mitigation) would let the client finish that old session AND the
 *     fresh one the caller creates next = double charge with no internal trace.
 *       - paid / captured / authorized  → throw `alreadyPaid` (never recreate).
 *       - initiated                      → throw `inFlight` (a live session).
 *       - failed / voided / refunded     → dead session, safe to discard.
 *       - gateway lookup failed          → fail closed (throw), never recreate a
 *                                          session we could not verify.
 *   - The row is then deleted so the caller can create a fresh PENDING payment
 *     and always return a valid redirect URL.
 *
 * The caller is responsible for the prior COMPLETED-status short-circuit (its
 * conflict message differs); this helper handles only the gatewayRef path and
 * the discard.
 */
export async function reconcileOrDiscardInFlightPayment(
  prisma: PrismaService,
  moyasar: MoyasarApiClient,
  logger: Logger,
  existingPayment: InFlightPaymentRow,
  messages: ReconcileMessages,
): Promise<'TERMINAL_FAILED'> {
  if (!existingPayment.gatewayRef) {
    // A missing reference does not prove that Moyasar never created the hosted
    // invoice: the process can fail after Moyasar accepts the POST and before
    // gatewayRef is stored. Keep the reservation so a retry cannot create a
    // second charge while the first outcome is still unknown.
    throw new ConflictException('تعذّر التحقق من حالة الدفعة الجارية، حاول مرة أخرى لاحقاً');
  }

  if (existingPayment.gatewayRef) {
    let gatewayStatus: string;
    try {
      const gw = await moyasar.getPaymentStatus(DEFAULT_ORG_ID, existingPayment.gatewayRef);
      gatewayStatus = gw.status;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(
          `Failed to reconcile in-flight payment ${existingPayment.id}`,
          error.stack,
        );
      }
      // Fail closed: never recreate a session we could not verify.
      throw new ConflictException('تعذّر التحقق من حالة الدفعة الجارية، حاول مرة أخرى لاحقاً');
    }
    if (TERMINAL_PAID_STATUSES.includes(gatewayStatus)) {
      throw new ConflictException(messages.alreadyPaid);
    }
    if (gatewayStatus === 'initiated') {
      throw new ConflictException(messages.inFlight);
    }
    if (!TERMINAL_FAILED_STATUSES.includes(gatewayStatus)) {
      throw new ConflictException('تعذّر التحقق من حالة الدفعة الجارية، حاول مرة أخرى لاحقاً');
    }
    // Explicit failed / voided / refunded proof means the session is dead.
  }
  // The caller must delete and replace inside one invoice-locked transaction.
  // Provider evidence is authoritative, but it can become stale before cleanup.
  void prisma;
  return 'TERMINAL_FAILED';
}

export async function replaceTerminalInFlightPayment<T>(
  rlsTransaction: RlsTransactionService,
  invoiceId: string,
  expected: ReplaceablePaymentRow,
  createReplacement: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return rlsTransaction.withTransaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`,
    );
    const current = await tx.payment.findUnique({
      where: { id: expected.id },
      select: { status: true, gatewayRef: true },
    });
    if (
      !current ||
      current.status !== expected.status ||
      (current.status !== PaymentStatus.PENDING && current.status !== PaymentStatus.FAILED) ||
      current.gatewayRef !== expected.gatewayRef
    ) {
      throw new ConflictException('Payment state changed while reconciling the gateway');
    }
    await tx.payment.delete({ where: { id: expected.id } });
    return createReplacement(tx);
  });
}

/**
 * Persist a hosted-invoice reference without overwriting a webhook's terminal
 * gateway payment identity. The Invoice lock orders this write with every
 * payment finalizer; the status/reference CAS detects a winner that ran first.
 */
export async function persistPendingGatewayRef(
  rlsTransaction: RlsTransactionService,
  invoiceId: string,
  expected: ReplaceablePaymentRow,
  gatewayRef: string,
): Promise<void> {
  const invoiceClosed = await rlsTransaction.withTransaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`,
    );
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true },
    });
    if (!invoice) {
      throw new ConflictException('Invoice state changed while storing the gateway reference');
    }
    const updated = await tx.payment.updateMany({
      where: {
        id: expected.id,
        status: PaymentStatus.PENDING,
        gatewayRef: expected.gatewayRef,
      },
      data: { gatewayRef },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Payment state changed while storing the gateway reference');
    }
    return isNonPayableInvoiceStatus(invoice.status as InvoiceStatus);
  });
  // Throw after commit so the provider identity remains durable for audit and
  // reconciliation, while the caller cannot expose a checkout for a closed invoice.
  if (invoiceClosed) {
    throw new ConflictException('Invoice can no longer accept this payment');
  }
}
