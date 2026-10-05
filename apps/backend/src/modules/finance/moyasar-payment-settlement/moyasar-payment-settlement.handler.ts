import { isElapsedUnconfirmedBookingHold } from '../booking-payment-hold.helper';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BookingStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../infrastructure/database';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { PaymentCompletedEvent } from '../events/payment-completed.event';
import { PaymentFailedEvent } from '../events/payment-failed.event';
import { DepositPaidEvent } from '../events/deposit-paid.event';
import { resolveInvoiceDeposit, isDepositPayment } from '../deposit.helper';

import { AppMetricsService } from '../../../infrastructure/telemetry/app-metrics.service';
import {
  MoyasarPaymentStatus,
  MoyasarPaymentStatusResult,
} from '../moyasar-api/moyasar-api.client';
import { assertValidTransition } from '../payment-state-machine';
import { stableEventId } from '../../../common/events';
import {
  isClosedInvoiceStatus,
  isNonPayableInvoiceStatus,
} from '../invoice-payment-state.helper';

const TERMINAL_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.CANCELLED,
  BookingStatus.NO_SHOW,
  BookingStatus.EXPIRED,
]);

interface SettlementMutationResult {
  skipped?: boolean;
  reason?: string;
}
export interface MoyasarSettlementCommand {
  invoiceId: string;
  gatewayPaymentId: string;
  gatewayRefs: readonly string[];
  fetched: MoyasarPaymentStatusResult;
  message?: string;
  requiredPaymentId?: string;
}
@Injectable()
export class MoyasarPaymentSettlementHandler {
  private readonly logger = new Logger(MoyasarPaymentSettlementHandler.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    @Optional() private readonly appMetrics: AppMetricsService | null = null,
  ) {}
  async execute(
    cmd: MoyasarSettlementCommand,
  ): Promise<SettlementMutationResult & { requiresReview: boolean }> {
    const {
      invoiceId,
      gatewayPaymentId: paymentId,
      gatewayRefs,
      fetched,
      message,
      requiredPaymentId,
    } = cmd;
    if (
      fetched.id !== paymentId ||
      (fetched.metadata?.invoiceId && fetched.metadata.invoiceId !== invoiceId)
    )
      return {
        skipped: true,
        reason: 'identity_mismatch',
        requiresReview: false,
      };
    const resolvedInvoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId },
    });
    if (!resolvedInvoice)
      return {
        skipped: true,
        reason: 'invoice_not_found',
        requiresReview: false,
      };
    let requiresReview = false;

    const paymentMatchWhere: Prisma.PaymentWhereInput = {
      invoiceId: resolvedInvoice.id,
      ...(requiredPaymentId
        ? { id: requiredPaymentId, gatewayRef: paymentId }
        : {}),
      OR: [
        ...gatewayRefs.map((gatewayRef) => ({ gatewayRef })),
        { idempotencyKey: `moyasar:${paymentId}` },
      ],
    };

    // Map the AUTHORITATIVE Moyasar status to the internal PaymentStatus.
    //   paid / captured  → COMPLETED
    //   failed / voided  → FAILED
    //   anything else (authorized, initiated, pending-like) → not terminal
    const status = this.toTerminalStatus(fetched.status);
    if (status === null) {
      // Permanent for THIS delivery: the payment is not in a terminal state
      // yet. A later webhook will carry the terminal status — ack this one.
      this.logger.log(
        `Moyasar webhook: payment ${paymentId} not yet terminal ` +
          `(status=${fetched.status}, invoice ${resolvedInvoice.id}) — skipping`,
      );
      return {
        skipped: true,
        reason: `non_terminal_status:${fetched.status}`,
        requiresReview: false,
      };
    }

    // STAGE 8 — run mutations inside the default org compatibility CLS context.
    // Payment.amount is stored in halalas — fetched.amount is already halalas.
    const amountHalalas = fetched.amount;
    // Σ COMPLETED payments AFTER the write — needed outside the tx to decide
    // whether a deposit-sized partial payment should emit DepositPaidEvent.
    let paidAfterWrite = 0;
    const result = await (async () => {
      // Wrap payment upsert + invoice update + domain-event outbox write in a
      // single transaction to ensure atomicity — if any step fails, all roll
      // back and no inconsistent state is stored. `savedPayment.id` is the
      // internal Payment ROW id; `paymentId` (above) is the Moyasar gateway
      // payment id — they are distinct values.
      const mutationSkip =
        await this.rlsTransaction.withTransaction<SettlementMutationResult | null>(
          async (tx) => {
            // All monetary transactions acquire booking (when present) → invoice
            // → payment. Keep this order aligned with reconciliation and refund
            // creation so a late callback cannot deadlock another balance writer.
            let lockedBookingStatus: BookingStatus | null = null;
            let elapsedBookingHold = false;
            if (resolvedInvoice.bookingId) {
              await tx.$queryRaw(
                Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${resolvedInvoice.bookingId} FOR UPDATE`,
              );
              const lockedBooking = await tx.booking.findUnique({
                where: { id: resolvedInvoice.bookingId },
                select: { status: true, expiresAt: true, isHistoricalImport: true },
              });
              if (lockedBooking) {
                lockedBookingStatus = lockedBooking.status;
                elapsedBookingHold =
                  isElapsedUnconfirmedBookingHold(lockedBooking);
              }
            }

            await tx.$queryRaw(
              Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${resolvedInvoice.id} FOR UPDATE`,
            );
            const lockedInvoice = await tx.invoice.findFirst({
              where: { id: resolvedInvoice.id },
              select: {
                id: true,
                total: true,
                currency: true,
                bookingId: true,
                packagePurchaseId: true,
                clientId: true,
                issuedAt: true,
                status: true,
              },
            });
            if (!lockedInvoice) {
              return { skipped: true, reason: 'invoice_not_found' };
            }
            let payment = await tx.payment.findFirst({
              where: paymentMatchWhere,
              orderBy: [{ gatewayRef: 'desc' }, { updatedAt: 'desc' }],
              select: {
                id: true,
                status: true,
                amount: true,
                currency: true,
                gatewayRef: true,
              },
            });
            if (payment) {
              await tx.$queryRaw(
                Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`,
              );
              // Re-read after the row lock. The pre-lock lookup is only a route
              // candidate and must not decide a transition from stale status.
              const lockedPayment = await tx.payment.findFirst({
                where: { id: payment.id },
                select: {
                  id: true,
                  status: true,
                  amount: true,
                  currency: true,
                  gatewayRef: true,
                },
              });
              if (lockedPayment) payment = lockedPayment;
            }
            if (
              requiredPaymentId &&
              (!payment || payment.id !== requiredPaymentId)
            )
              return { skipped: true, reason: 'payment_not_found' };
            const invoiceStatus = lockedInvoice.status as InvoiceStatus;
            const latePaidBooking =
              status === PaymentStatus.COMPLETED &&
              lockedBookingStatus !== null &&
              (TERMINAL_BOOKING_STATUSES.has(lockedBookingStatus) ||
                elapsedBookingHold);
            const latePaidAgainstClosedInvoice =
              status === PaymentStatus.COMPLETED &&
              !latePaidBooking &&
              (isClosedInvoiceStatus(invoiceStatus) ||
                (isNonPayableInvoiceStatus(invoiceStatus) &&
                  payment?.status !== PaymentStatus.COMPLETED));
            requiresReview = latePaidBooking || latePaidAgainstClosedInvoice;
            if (latePaidAgainstClosedInvoice) {
              this.logger.error(
                `Moyasar payment ${paymentId} is paid after invoice ${lockedInvoice.id} entered ` +
                  `${lockedInvoice.status}; internalPayment=${payment?.id ?? 'unmatched'}; ` +
                  `preserving the invoice for manual review`,
              );
              return { skipped: true, reason: 'terminal_invoice' };
            }

            if (
              fetched.currency.toUpperCase() !==
              lockedInvoice.currency.toUpperCase()
            ) {
              return { skipped: true, reason: 'currency_mismatch' };
            }
            const lockedDeposit = await resolveInvoiceDeposit(
              tx,
              lockedInvoice.bookingId,
            );

            if (payment?.status === PaymentStatus.REFUNDED) {
              return { skipped: true, reason: 'already_refunded' };
            }
            if (payment) {
              try {
                assertValidTransition(payment.status, status);
              } catch {
                return { skipped: true, reason: 'invalid_transition' };
              }
            }

            if (payment) {
              if (
                Math.round(Number(payment.amount)) !== amountHalalas ||
                payment.currency.toUpperCase() !==
                  fetched.currency.toUpperCase()
              ) {
                return { skipped: true, reason: 'amount_mismatch' };
              }
            } else {
              const priorPaid = await tx.payment.aggregate({
                where: {
                  invoiceId: lockedInvoice.id,
                  status: PaymentStatus.COMPLETED,
                },
                _sum: { amount: true },
              });
              const alreadyPaid = Number(priorPaid._sum?.amount ?? 0);
              const total = Math.round(Number(lockedInvoice.total));
              const outstanding = total - alreadyPaid;
              const acceptsDeposit =
                lockedDeposit.enabled &&
                lockedDeposit.depositAmount != null &&
                alreadyPaid === 0 &&
                amountHalalas === lockedDeposit.depositAmount;
              if (amountHalalas !== outstanding && !acceptsDeposit) {
                return { skipped: true, reason: 'amount_mismatch' };
              }
            }

            if (
              (requiredPaymentId ||
                (payment && payment.gatewayRef === payment.id)) &&
              status === PaymentStatus.COMPLETED &&
              !latePaidBooking
            ) {
              const collected = await tx.payment.aggregate({
                where: {
                  invoiceId: lockedInvoice.id,
                  status: PaymentStatus.COMPLETED,
                },
                _sum: { amount: true },
              });
              if (
                amountHalalas !==
                Number(lockedInvoice.total) -
                  Number(collected._sum?.amount ?? 0)
              )
                return { skipped: true, reason: 'amount_mismatch' };
            }

            const savedPayment = payment
              ? await tx.payment.update({
                  where: { id: payment.id },
                  data: {
                    status,
                    processedAt:
                      status === PaymentStatus.COMPLETED
                        ? new Date()
                        : undefined,
                    failureReason: message,
                    gatewayRef: paymentId,
                    idempotencyKey: `moyasar:${paymentId}`,
                  },
                })
              : await tx.payment.create({
                  data: {
                    invoiceId: lockedInvoice.id,
                    amount: amountHalalas,
                    currency: lockedInvoice.currency,
                    method: PaymentMethod.ONLINE_CARD,
                    status,
                    gatewayRef: paymentId,
                    idempotencyKey: `moyasar:${paymentId}`,
                    processedAt:
                      status === PaymentStatus.COMPLETED
                        ? new Date()
                        : undefined,
                    failureReason: message,
                  },
                });

            if (latePaidBooking) {
              // The gateway callback remains a real captured payment even when
              // cancellation/expiry committed first. Keep the money visible and
              // queue one explicit review request: the cancellation policy does
              // not define a fee for this race, so approval must remain manual.
              const sourceEventId = stableEventId(
                `finance:late-payment:${resolvedInvoice.id}:${paymentId}`,
              );
              const idempotencyKey = `refund:late-payment:${paymentId}`;
              const existingReview = await tx.refundRequest.findUnique({
                where: { sourceEventId },
                select: { id: true },
              });
              if (!existingReview) {
                await tx.refundRequest.create({
                  data: {
                    invoiceId: lockedInvoice.id,
                    paymentId: savedPayment.id,
                    clientId: lockedInvoice.clientId,
                    amount: amountHalalas,
                    reason: elapsedBookingHold
                      ? 'Payment completed after program hold deadline — manual refund review required'
                      : `Payment completed after booking ${lockedBookingStatus?.toLowerCase() ?? 'terminal'} — manual refund review required`,
                    status: 'PENDING_REVIEW',
                    idempotencyKey,
                    sourceEventId,
                    providerState: 'NOT_CALLED',
                  },
                });
              }
            }

            let fullyPaid = false;
            if (status === PaymentStatus.COMPLETED) {
              // P0: re-aggregate COMPLETED payments AFTER the write and derive the
              // invoice status from the total collected — a top-up that only
              // covers part of the balance must land PARTIALLY_PAID, not PAID.
              // paidAt is stamped ONLY when the invoice is fully settled. Mirrors
              // ProcessPaymentHandler so card and operator payments agree.
              const totalPaid = await tx.payment.aggregate({
                where: {
                  invoiceId: lockedInvoice.id,
                  status: PaymentStatus.COMPLETED,
                },
                _sum: { amount: true },
              });
              const paid = Number(totalPaid._sum?.amount ?? 0);
              const total = Math.round(Number(lockedInvoice.total));
              fullyPaid = paid >= total;
              paidAfterWrite = paid;
              // A terminal booking can receive a callback after cancellation has
              // already closed/refunded its invoice. Keep that accounting state
              // intact while the Payment row and explicit review request preserve
              // the captured money for reconciliation.
              if (
                !latePaidBooking ||
                !isNonPayableInvoiceStatus(invoiceStatus)
              ) {
                await tx.invoice.update({
                  where: { id: lockedInvoice.id },
                  data: {
                    status: fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
                    // Stamp issuance time on the first payment that lifts the invoice
                    // out of DRAFT; keep an existing issuedAt untouched.
                    issuedAt: lockedInvoice.issuedAt ?? new Date(),
                    paidAt: fullyPaid ? new Date() : undefined,
                  },
                });
              }
            }

            // P1-12: write domain events to the OutboxEvent table INSIDE this same
            // transaction instead of publishing directly after commit. The previous
            // code awaited eventBus.publish() AFTER the tx committed — if the process
            // crashed (or the broker was unreachable) in that window, the event was
            // lost forever: the payment was COMPLETED and the invoice PAID, but the
            // booking never confirmed and no receipt was sent, and nothing could
            // rescue it. By staging the event in the same atomic write, the
            // OutboxPublisherCron guarantees at-least-once delivery — mirrors the
            // create-booking outbox pattern.
            //
            // PaymentCompletedEvent is staged ONLY when the invoice is fully PAID —
            // downstream consumers (booking confirmation, receipts) must not react
            // to a still-outstanding invoice.
            if (
              status === PaymentStatus.COMPLETED &&
              fullyPaid &&
              !latePaidBooking
            ) {
              const event = new PaymentCompletedEvent({
                paymentId: savedPayment.id,
                invoiceId: lockedInvoice.id,
                bookingId: lockedInvoice.bookingId,
                packagePurchaseId: lockedInvoice.packagePurchaseId,
                amount: amountHalalas,
                currency: lockedInvoice.currency,
                organizationId: DEFAULT_ORG_ID,
              });
              await tx.outboxEvent.create({
                data: {
                  id: stableEventId(
                    `finance:payment:${savedPayment.id}:${event.eventName}`,
                  ),
                  aggregateId: lockedInvoice.id,
                  eventType: event.eventName,
                  status: 'PENDING_V2',
                  deliveryLane: 'PENDING_V2',
                  payload: {
                    ...event.toEnvelope(),
                    eventId: stableEventId(
                      `finance:payment:${savedPayment.id}:${event.eventName}`,
                    ),
                  } as unknown as Prisma.InputJsonValue,
                },
              });
            } else if (
              status === PaymentStatus.COMPLETED &&
              !latePaidBooking &&
              isDepositPayment({
                paidAfter: paidAfterWrite,
                total: Math.round(Number(lockedInvoice.total)),
                depositAmount: lockedDeposit.enabled
                  ? lockedDeposit.depositAmount
                  : null,
              })
            ) {
              // The card payment exactly matched the configured deposit and the
              // invoice is still PARTIALLY_PAID — move the booking to DEPOSIT_PAID
              // (reserving staff time) without confirming the appointment.
              const event = new DepositPaidEvent({
                paymentId: savedPayment.id,
                invoiceId: lockedInvoice.id,
                bookingId: lockedInvoice.bookingId,
                amount: amountHalalas,
                currency: lockedInvoice.currency,
                organizationId: DEFAULT_ORG_ID,
              });
              await tx.outboxEvent.create({
                data: {
                  id: stableEventId(
                    `finance:payment:${savedPayment.id}:${event.eventName}`,
                  ),
                  aggregateId: lockedInvoice.id,
                  eventType: event.eventName,
                  status: 'PENDING_V2',
                  deliveryLane: 'PENDING_V2',
                  payload: {
                    ...event.toEnvelope(),
                    eventId: stableEventId(
                      `finance:payment:${savedPayment.id}:${event.eventName}`,
                    ),
                  } as unknown as Prisma.InputJsonValue,
                },
              });
            } else if (status === PaymentStatus.FAILED) {
              const failedEvent = new PaymentFailedEvent({
                paymentId: savedPayment.id,
                invoiceId: lockedInvoice.id,
                clientId: lockedInvoice.clientId,
                amount: amountHalalas,
                currency: lockedInvoice.currency,
                reason: message,
              });
              await tx.outboxEvent.create({
                data: {
                  id: stableEventId(
                    `finance:payment:${savedPayment.id}:${failedEvent.eventName}`,
                  ),
                  aggregateId: lockedInvoice.id,
                  eventType: failedEvent.eventName,
                  status: 'PENDING_V2',
                  deliveryLane: 'PENDING_V2',
                  payload: {
                    ...failedEvent.toEnvelope(),
                    eventId: stableEventId(
                      `finance:payment:${savedPayment.id}:${failedEvent.eventName}`,
                    ),
                  } as unknown as Prisma.InputJsonValue,
                },
              });
            }

            return null;
          },
        );

      if (mutationSkip) return mutationSkip;

      // Metrics are best-effort observability only — they carry no fulfillment
      // semantics, so they stay outside the transaction. The success metric
      // increments on ANY COMPLETED card payment (a partial top-up is still a
      // successful charge).
      if (status === PaymentStatus.COMPLETED) {
        this.appMetrics?.paymentAttempts.labels({ result: 'succeeded' }).inc();
      } else if (status === PaymentStatus.FAILED) {
        this.appMetrics?.paymentAttempts.labels({ result: 'failed' }).inc();
      }

      return {} as SettlementMutationResult;
    })();
    return { ...result, requiresReview };
  }
  private toTerminalStatus(status: MoyasarPaymentStatus): PaymentStatus | null {
    switch (status) {
      case 'paid':
      case 'captured':
        return PaymentStatus.COMPLETED;
      case 'failed':
      case 'voided':
        return PaymentStatus.FAILED;
      default:
        // authorized, initiated, refunded (handled by the REFUNDED guard), …
        return null;
    }
  }
}
