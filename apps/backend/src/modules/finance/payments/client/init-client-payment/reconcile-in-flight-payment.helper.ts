import { ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../../infrastructure/database';
import { MoyasarApiClient } from '../../../moyasar-api/moyasar-api.client';
import { DEFAULT_ORG_ID } from '../../../../../common/constants';

/**
 * Minimal shape of the existing PENDING payment row a caller has already loaded
 * by its `@unique` idempotencyKey. Only the fields the reconciliation needs.
 */
export interface InFlightPaymentRow {
  id: string;
  gatewayRef: string | null;
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
): Promise<void> {
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
    // failed / voided / refunded → the session is dead, safe to discard.
  }
  // No gatewayRef yet, or a terminally-failed session: discard so the caller can
  // recreate and always return a valid redirect URL.
  await prisma.payment.delete({ where: { id: existingPayment.id } });
}
