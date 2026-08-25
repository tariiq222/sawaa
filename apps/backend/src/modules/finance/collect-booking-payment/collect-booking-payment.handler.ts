import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { CollectBookingPaymentDto } from './collect-booking-payment.dto';
import { EnsureBookingInvoiceHandler } from '../ensure-booking-invoice/ensure-booking-invoice.handler';
import { ApplyInvoiceDiscountHandler } from '../apply-invoice-discount/apply-invoice-discount.handler';
import { ProcessPaymentHandler } from '../process-payment/process-payment.handler';

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

/**
 * Single-command reception collection: ensure invoice → apply optional manual
 * discount → record the payment. Does NOT change any underlying handler — it
 * only composes existing finance slices so a manual collection stays one HTTP
 * call.
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

    // ── 1. Ensure invoice ────────────────────────────────────────────────────
    // Inherits historical / no-client / zero-price / already-paid rejections.
    // We use the returned invoice shape as the source of truth for `id` and
    // `outstanding` after any recomputation below.
    const ensured = await this.ensureBookingInvoice.execute({ bookingId: cmd.bookingId });
    const invoiceId = ensured.id;

    // ── 2. Optional manual discount ──────────────────────────────────────────
    // ApplyInvoiceDiscountHandler recomputes subtotal/VAT/total and (when
    // discountAmt > 0) writes discountReason + discountAppliedBy + note. We
    // skip the call entirely when no discountAmt is provided — a "clear" path
    // would also need a reason and we never want to silently wipe a stored
    // discount on a normal collection.
    if (typeof cmd.discountAmt === 'number' && cmd.discountAmt > 0) {
      await this.applyInvoiceDiscount.execute({
        invoiceId,
        appliedBy: cmd.appliedBy,
        discountAmt: cmd.discountAmt,
        discountReasonId: cmd.discountReasonId,
        note: cmd.note,
      });
    }

    // ── 3. Re-read the invoice shape (idempotent) ────────────────────────────
    // ensureBookingInvoice is the only source of truth for the post-discount
    // total + outstanding — a recomputed discount changes the outstanding, so
    // re-running shape() guarantees we charge against the freshly-recomputed
    // balance and not a stale snapshot from step 1.
    const invoice = await this.ensureBookingInvoice.execute({ bookingId: cmd.bookingId });

    // ── 4. Skip processPayment when nothing is owed ──────────────────────────
    // A 100% discount leaves outstanding <= 0; we still return success so the
    // dashboard can show "fully discounted" without inventing a zero-amount
    // payment row.
    if (invoice.outstanding <= 0) {
      return {
        bookingId: cmd.bookingId,
        invoice: {
          id: invoice.id,
          subtotal: invoice.subtotal,
          vatRate: invoice.vatRate,
          total: invoice.total,
          outstanding: invoice.outstanding,
          status: invoice.status,
        },
        payment: null,
      };
    }

    // ── 5. Record the manual payment ────────────────────────────────────────
    // When amount is omitted, the caller asked for "the full outstanding after
    // discount" — pass it through unchanged. ProcessPaymentHandler still
    // enforces the SAR-vs-halalas tripwire + amount>0 + amount<=outstanding +
    // Moyasar in-flight / deposit invariants, so this slice stays a thin
    // composer and never re-implements payment math.
    //
    // `cmd.amount ?? invoice.outstanding` is computed against the PRE-payment
    // read (step 3). The pre-payment read is the only correct source for the
    // charge amount: the post-payment outstanding is by definition smaller
    // (or zero), so charging against it would silently undercharge every
    // partial collection. We re-read the invoice shape in step 6 solely to
    // populate the response truth, never to drive the charge.
    const payment = await this.processPayment.execute({
      invoiceId,
      amount: cmd.amount ?? invoice.outstanding,
      method: cmd.method,
      idempotencyKey: cmd.idempotencyKey,
    });

    // ── 6. Re-read the invoice shape AFTER the payment was recorded ─────────
    // The first ensure (step 1) and the second ensure (step 3) both run before
    // any payment row is written — they reflect pre-payment outstanding, which
    // is what the caller already knows (and what we charge against). Returning
    // either of them in the response would lie: the dashboard booking-details
    // and completion screens now surface `invoice.outstanding` and
    // `invoice.status`, so the response must reflect the post-collection state.
    // ensureBookingInvoice is idempotent and recomputes outstanding by
    // summing COMPLETED payments, so this third read returns the truth
    // without any extra Prisma plumbing in this slice.
    const settled = await this.ensureBookingInvoice.execute({ bookingId: cmd.bookingId });

    return {
      bookingId: cmd.bookingId,
      invoice: {
        id: settled.id,
        subtotal: settled.subtotal,
        vatRate: settled.vatRate,
        total: settled.total,
        outstanding: settled.outstanding,
        status: settled.status,
      },
      // Prisma Decimal → integer halalas at the read boundary. Math.round
      // absorbs any fractional remnant and the safe-integer math is enforced
      // by decimalToHalalas on the ensure-side.
      payment: {
        id: payment.id,
        amount: Math.round(Number(payment.amount)),
        method: payment.method,
        status: payment.status,
      },
    };
  }
}
