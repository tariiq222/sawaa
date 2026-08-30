import { createHash } from 'crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../infrastructure/database';
import { CollectBookingPaymentDto } from './collect-booking-payment.dto';
import { EnsureBookingInvoiceHandler } from '../ensure-booking-invoice/ensure-booking-invoice.handler';
import { ApplyInvoiceDiscountHandler } from '../apply-invoice-discount/apply-invoice-discount.handler';
import {
  ProcessPaymentHandler,
  type DeferredPaymentEvent,
} from '../process-payment/process-payment.handler';

/**
 * Command = DTO + booking context + acting user.
 *
 * The controller injects `bookingId` from the URL path and `appliedBy` from the
 * JWT subject via `@UserId()`. The DTO is spread last so handler-side field
 * overrides are explicit.
 */
export type CollectBookingPaymentCommand = CollectBookingPaymentDto & {
  bookingId: string;
  appliedBy: string;
};

export interface CollectBookingPaymentInvoiceShape {
  id: string;
  subtotal: number;
  vatRate: number;
  total: number;
  outstanding: number;
  status: string;
}

export interface CollectBookingPaymentPaymentShape {
  id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
}

export interface CollectBookingPaymentResult {
  bookingId: string;
  invoice: CollectBookingPaymentInvoiceShape;
  payment: CollectBookingPaymentPaymentShape | null;
}

type CollectTxOutcome = {
  result: CollectBookingPaymentResult;
  deferredEvents: DeferredPaymentEvent[];
};

type CollectionIdempotencyRecord = {
  invoiceId: string;
  requestFingerprint: string;
  paymentId: string | null;
  payment: {
    id: string;
    amount: Prisma.Decimal | number;
    method: PaymentMethod;
    status: PaymentStatus;
  } | null;
};

/**
 * sha256 of canonical non-PII collect fields. Same key + same invoice + same
 * fingerprint replays; any other combination is a conflict.
 */
export function collectRequestFingerprint(input: {
  invoiceId: string;
  method: PaymentMethod;
  amount?: number;
  discountAmt?: number;
  discountReasonId?: string;
  note?: string;
}): string {
  const canonical = JSON.stringify({
    invoiceId: input.invoiceId,
    method: input.method,
    amount: input.amount ?? null,
    discountAmt: typeof input.discountAmt === 'number' && input.discountAmt > 0 ? input.discountAmt : null,
    discountReasonId: input.discountReasonId ?? null,
    note: input.note ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Single-command reception collection: ensure invoice → apply optional manual
 * discount → record the payment. Discount mutation, payment mutation, the
 * idempotency reservation, and the rereads that drive the charge / response
 * share one interactive transaction so a failed payment cannot leave a
 * persisted discount or a stuck key behind.
 *
 * Manual/statistical methods only. ONLINE_CARD must come through the Moyasar
 * webhook; COUPON is a redemption flow (ApplyCouponHandler), not a payment.
 * Both are rejected here, BEFORE any composed handler is invoked, so a misclick
 * cannot leak a card row without a gateway confirmation.
 */
@Injectable()
export class CollectBookingPaymentHandler {
  constructor(
    private readonly ensureBookingInvoice: EnsureBookingInvoiceHandler,
    private readonly applyInvoiceDiscount: ApplyInvoiceDiscountHandler,
    private readonly processPayment: ProcessPaymentHandler,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: CollectBookingPaymentCommand): Promise<CollectBookingPaymentResult> {
    // ── 0. Method gate ───────────────────────────────────────────────────────
    // Reject ONLINE_CARD and COUPON explicitly here so the dashboard's "manual
    // collection" endpoint can never mint a card row without the gateway, and
    // a coupon is never recorded as a payment (coupons reduce the invoice via
    // couponRedemptions, not via a Payment row).
    if (cmd.method === PaymentMethod.ONLINE_CARD) {
      throw new BadRequestException(
        'ONLINE_CARD payments must come through the Moyasar webhook flow, not the reception manual-collection endpoint',
      );
    }
    if (cmd.method === PaymentMethod.COUPON) {
      throw new BadRequestException(
        'COUPON is a redemption flow (ApplyCouponHandler), not a manual payment',
      );
    }

    // ── 1. Ensure invoice (outside the atomic tx) ────────────────────────────
    // CreateInvoiceHandler cannot join our transaction. Materialising a missing
    // DRAFT invoice is idempotent and is not the discount-without-payment
    // failure mode this slice closes.
    const ensured = await this.ensureBookingInvoice.execute({ bookingId: cmd.bookingId });
    const invoiceId = ensured.id;
    const fingerprint = cmd.idempotencyKey
        ? collectRequestFingerprint({
          invoiceId,
          method: cmd.method,
          amount: cmd.amount,
          discountAmt: cmd.discountAmt,
          discountReasonId: cmd.discountReasonId,
          note: cmd.note,
        })
      : null;

    let outcome: CollectTxOutcome;
    try {
      outcome = await this.rlsTransaction.withTransaction(async (tx): Promise<CollectTxOutcome> => {
        if (cmd.idempotencyKey && fingerprint) {
          const existing = await this.findCollectionRecord(tx, cmd.idempotencyKey);
          if (existing) {
            return this.replayOrConflict(existing, cmd, invoiceId, fingerprint, tx);
          }

          // Let P2002 escape this transaction. PostgreSQL aborts the tx on a
          // unique violation; any follow-up read on `tx` would fail with
          // "current transaction is aborted". Recovery runs after rollback.
          await tx.paymentCollectionIdempotency.create({
            data: {
              idempotencyKey: cmd.idempotencyKey,
              invoiceId,
              requestFingerprint: fingerprint,
            },
          });
        }

        // ── 2. Optional manual discount (same tx as the payment) ───────────────
        if (typeof cmd.discountAmt === 'number' && cmd.discountAmt > 0) {
          await this.applyInvoiceDiscount.execute({
            invoiceId,
            appliedBy: cmd.appliedBy,
            discountAmt: cmd.discountAmt,
            discountReasonId: cmd.discountReasonId,
            note: cmd.note,
            transaction: tx,
          });
        }

        // ── 3. Re-read the invoice shape against the open tx ───────────────────
        const invoice = await this.ensureBookingInvoice.execute({
          bookingId: cmd.bookingId,
          transaction: tx,
        });

        // ── 4. Skip processPayment when nothing is owed ────────────────────────
        // A 100% discount leaves outstanding <= 0; we still return success so the
        // dashboard can show "fully discounted" without inventing a zero-amount
        // payment row. The discount write above commits with this transaction.
        if (invoice.outstanding <= 0) {
          return {
            result: this.toResult(cmd.bookingId, invoice, null),
            deferredEvents: [],
          };
        }

        // ── 5. Record the manual payment in the same transaction ───────────────
        const payment = await this.processPayment.execute({
          invoiceId,
          amount: cmd.amount ?? invoice.outstanding,
          method: cmd.method,
          idempotencyKey: cmd.idempotencyKey,
          transaction: tx,
        });

        if (cmd.idempotencyKey) {
          await tx.paymentCollectionIdempotency.update({
            where: { idempotencyKey: cmd.idempotencyKey },
            data: { paymentId: payment.id },
          });
        }

        // ── 6. Re-read AFTER the payment so the response is post-collection ────
        const settled = await this.ensureBookingInvoice.execute({
          bookingId: cmd.bookingId,
          transaction: tx,
        });

        return {
          result: this.toResult(cmd.bookingId, settled, {
            id: payment.id,
            amount: payment.amount,
            method: payment.method,
            status: payment.status as PaymentStatus,
          }),
          deferredEvents: this.readDeferredEvents(payment),
        };
      });
    } catch (err) {
      if (!this.isUniqueConstraintError(err) || !cmd.idempotencyKey || !fingerprint) {
        throw err;
      }
      // Fresh transaction: the failed collect tx has already rolled back.
      outcome = await this.rlsTransaction.withTransaction(async (tx) => {
        const raced = await this.findCollectionRecord(tx, cmd.idempotencyKey!);
        if (!raced) throw err;
        return this.replayOrConflict(raced, cmd, invoiceId, fingerprint, tx);
      });
    }

    // Publish only after the outer collect transaction committed. A reread or
    // commit failure above never reaches here, so no payment/deposit events leak.
    // Replay/conflict recovery returns deferredEvents: [] and must not emit.
    await this.processPayment.publishDeferredEvents(outcome.deferredEvents);
    return outcome.result;
  }

  private isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }

  private async findCollectionRecord(
    tx: Prisma.TransactionClient,
    idempotencyKey: string,
  ): Promise<CollectionIdempotencyRecord | null> {
    return tx.paymentCollectionIdempotency.findUnique({
      where: { idempotencyKey },
      include: { payment: true },
    });
  }

  private async replayOrConflict(
    existing: CollectionIdempotencyRecord,
    cmd: CollectBookingPaymentCommand,
    invoiceId: string,
    fingerprint: string,
    tx: Prisma.TransactionClient,
  ): Promise<CollectTxOutcome> {
    if (existing.invoiceId !== invoiceId) {
      throw new ConflictException('Idempotency key already used for a different invoice');
    }
    if (existing.requestFingerprint !== fingerprint) {
      throw new ConflictException('Idempotency key already used with a different request');
    }
    const invoice = await this.ensureBookingInvoice.execute({
      bookingId: cmd.bookingId,
      transaction: tx,
    });
    return {
      result: this.toResult(cmd.bookingId, invoice, existing.payment),
      deferredEvents: [],
    };
  }

  private readDeferredEvents(payment: { deferredEvents?: DeferredPaymentEvent[] }): DeferredPaymentEvent[] {
    return Array.isArray(payment.deferredEvents) ? payment.deferredEvents : [];
  }

  private toResult(
    bookingId: string,
    invoice: CollectBookingPaymentInvoiceShape,
    payment: {
      id: string;
      amount: Prisma.Decimal | number;
      method: PaymentMethod;
      status: PaymentStatus;
    } | null,
  ): CollectBookingPaymentResult {
    return {
      bookingId,
      invoice: {
        id: invoice.id,
        subtotal: invoice.subtotal,
        vatRate: invoice.vatRate,
        total: invoice.total,
        outstanding: invoice.outstanding,
        status: invoice.status,
      },
      payment: payment
        ? {
            id: payment.id,
            amount: Math.round(Number(payment.amount)),
            method: payment.method,
            status: payment.status,
          }
        : null,
    };
  }
}
