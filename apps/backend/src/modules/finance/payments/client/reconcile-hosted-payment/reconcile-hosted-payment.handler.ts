import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BookingStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../../../infrastructure/database';
import { DEFAULT_ORG_ID } from '../../../../../common/constants';
import {
  MoyasarApiClient,
  MoyasarCheckoutInvoiceStatus,
  MoyasarPaymentStatusResult,
} from '../../../moyasar-api/moyasar-api.client';
import { MoyasarPaymentSettlementHandler } from '../../../moyasar-payment-settlement/moyasar-payment-settlement.handler';
import { isNonPayableInvoiceStatus } from '../../../invoice-payment-state.helper';
import type { ReconcileHostedPaymentResponseDto } from './reconcile-hosted-payment.dto';

/** A payment younger than this is left to the webhook; protects the provider from poll bursts. */
export const HOSTED_RECONCILE_MIN_AGE_MS = 8_000;

const TERMINAL_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.CANCELLED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
  BookingStatus.EXPIRED,
]);

/** Hosted-invoice states that end the checkout without a payment (no retry is possible). */
const DEAD_CHECKOUT_STATUSES = new Set<MoyasarCheckoutInvoiceStatus>([
  'expired',
  'failed',
  'canceled',
  'voided',
]);

const FAILURE_MESSAGE = 'Reconciled from Moyasar (failed/voided)';

/**
 * On-demand reconcile for a website hosted-checkout card payment, so a client
 * whose Moyasar webhook is late does not wait for the 15-minute cron. Settlement
 * is delegated to the shared settlement handler, which locks and validates the
 * transition; a webhook that wins the race turns this into a harmless no-op.
 */
@Injectable()
export class ReconcileHostedPaymentHandler {
  private readonly logger = new Logger(ReconcileHostedPaymentHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moyasar: MoyasarApiClient,
    private readonly settlement: MoyasarPaymentSettlementHandler,
  ) {}

  async execute(cmd: { clientId: string; bookingId: string }): Promise<ReconcileHostedPaymentResponseDto> {
    // Unknown id and another client's booking are indistinguishable (no existence leak).
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId, clientId: cmd.clientId },
      select: { id: true, status: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const payment = await this.prisma.payment.findFirst({
      where: { method: PaymentMethod.ONLINE_CARD, invoice: { bookingId: booking.id } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        gatewayRef: true,
        updatedAt: true,
        invoiceId: true,
        invoice: { select: { status: true } },
      },
    });

    let reconciled = false;
    if (
      payment &&
      payment.status === PaymentStatus.PENDING &&
      // null: init has not stored the hosted invoice yet; equal to id: native reservation.
      payment.gatewayRef &&
      payment.gatewayRef !== payment.id &&
      Date.now() - payment.updatedAt.getTime() > HOSTED_RECONCILE_MIN_AGE_MS &&
      !TERMINAL_BOOKING_STATUSES.has(booking.status) &&
      !isNonPayableInvoiceStatus(payment.invoice.status)
    ) {
      reconciled = await this.settleFromProvider(booking.id, payment.id, payment.invoiceId, payment.gatewayRef);
    }

    const current = await this.readState(booking.id);
    return {
      bookingId: booking.id,
      status: current.status,
      paymentStatus: current.paymentStatus,
      reconciled,
      checkedAt: new Date().toISOString(),
    };
  }

  /** Never throws: any provider or settlement failure leaves the DB state untouched. */
  private async settleFromProvider(
    bookingId: string,
    paymentId: string,
    invoiceId: string,
    hostedInvoiceId: string,
  ): Promise<boolean> {
    try {
      const checkout = await this.moyasar.getCheckoutInvoice(DEFAULT_ORG_ID, hostedInvoiceId);
      const paidAttempt = checkout.payments.find((p) => ['paid', 'captured'].includes(p.status));
      // A failed card attempt on a still-open hosted invoice can be retried by the
      // client, so failure is only reflected once the hosted invoice itself is dead.
      const failedAttempt = DEAD_CHECKOUT_STATUSES.has(checkout.status)
        ? [...checkout.payments].reverse().find((p) => ['failed', 'voided'].includes(p.status))
        : undefined;
      const terminalAttempt = paidAttempt ?? failedAttempt;
      if (!terminalAttempt) return false;

      const fetched: MoyasarPaymentStatusResult = await this.moyasar.getPaymentStatus(
        DEFAULT_ORG_ID,
        terminalAttempt.id,
      );
      if (fetched.invoiceId && fetched.invoiceId !== hostedInvoiceId) {
        this.logger.error(
          `Hosted reconcile: payment ${fetched.id} belongs to another hosted invoice (booking ${bookingId}) — skipping`,
        );
        return false;
      }

      // No requiredPaymentId: the row's gatewayRef is the hosted invoice id, not the payment id.
      const applied = await this.settlement.execute({
        invoiceId,
        gatewayPaymentId: fetched.id,
        gatewayRefs: [hostedInvoiceId, fetched.id],
        fetched,
        message: paidAttempt ? undefined : FAILURE_MESSAGE,
      });
      if (applied.skipped) {
        // invalid_transition / already settled means a webhook won the race — not an error.
        this.logger.log(
          `Hosted reconcile for booking ${bookingId} payment ${paymentId} skipped: ${applied.reason ?? 'unknown'}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(
        `Hosted reconcile for booking ${bookingId} payment ${paymentId} failed: ` +
          `${error instanceof Error ? error.name : 'UnknownError'}`,
      );
      return false;
    }
  }

  private async readState(bookingId: string): Promise<{ status: string; paymentStatus: string }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true },
    });
    const payment = await this.prisma.payment.findFirst({
      where: { invoice: { bookingId } },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    return {
      status: booking?.status ?? 'NONE',
      paymentStatus: payment?.status ?? 'NONE',
    };
  }
}
