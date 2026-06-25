import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../../../infrastructure/database';
import { MoyasarApiClient } from '../../../moyasar-api/moyasar-api.client';
import { InitClientPaymentDto } from './init-client-payment.dto';
import { DEFAULT_ORG_ID } from '../../../../../common/constants';

const PAYMENT_INIT_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.AWAITING_PAYMENT,
];

export type InitClientPaymentCommand = InitClientPaymentDto & {
  clientId: string;
};

export interface InitClientPaymentResult {
  paymentId: string;
  redirectUrl: string;
  status?: string;
}

@Injectable()
export class InitClientPaymentHandler {
  private readonly logger = new Logger(InitClientPaymentHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moyasar: MoyasarApiClient,
  ) {}

  async execute(cmd: InitClientPaymentCommand): Promise<InitClientPaymentResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: cmd.invoiceId },
      select: { id: true, clientId: true, bookingId: true, total: true, currency: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${cmd.invoiceId} not found`);
    }
    if (invoice.clientId !== cmd.clientId) {
      throw new ForbiddenException('Invoice does not belong to this client');
    }

    // For package invoices, bookingId may be null — skip booking status check.
    if (invoice.bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: invoice.bookingId },
        select: { id: true, status: true },
      });
      if (!booking) {
        throw new NotFoundException(`Booking ${invoice.bookingId} not found`);
      }
      if (!PAYMENT_INIT_BOOKING_STATUSES.includes(booking.status)) {
        throw new BadRequestException(
          `Booking ${invoice.bookingId} cannot initialize payment in status ${booking.status}`,
        );
      }
    }

    const idempotencyKey = `client:${invoice.id}`;
    const existingPayment = await this.prisma.payment.findFirst({
      where: { idempotencyKey },
      select: { id: true, status: true, gatewayRef: true },
    });

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.COMPLETED) {
        throw new ConflictException('Payment for this invoice has already been completed');
      }
      // P1-7 mitigation: delete any non-completed payment (with or without gatewayRef)
      // and create a fresh one so the client always receives a valid redirectUrl.
      await this.prisma.payment.delete({ where: { id: existingPayment.id } });
    }

    // P0: charge only the OUTSTANDING balance, not the full invoice total. An
    // invoice may already carry a collected deposit (e.g. pay-at-clinic or a
    // prior partial). Sending the full total to Moyasar would double-charge the
    // deposit and the webhook would then reject the top-up as an amount_mismatch,
    // making the invoice impossible to complete by card. Sum COMPLETED payments
    // (the only authoritative paid status) and bill the remainder.
    const previouslyPaid = await this.prisma.payment.aggregate({
      where: { invoiceId: invoice.id, status: PaymentStatus.COMPLETED },
      _sum: { amount: true },
    });
    const alreadyPaid = Number(previouslyPaid._sum?.amount ?? 0);
    const outstanding = Math.round(Number(invoice.total)) - alreadyPaid;
    if (outstanding <= 0) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    // invoice.total and Payment.amount are both stored in halalas — bill the
    // outstanding remainder verbatim.
    const amountHalalas = outstanding;
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: outstanding,
        currency: invoice.currency,
        method: PaymentMethod.ONLINE_CARD,
        status: PaymentStatus.PENDING,
        idempotencyKey,
      },
      select: { id: true },
    });

    // Fresh idempotency identity per attempt. Keying on the invoice alone would
    // pin the FIRST amount: after a deposit, a top-up bills a smaller outstanding
    // and Moyasar would reject the changed amount with `400 already created`,
    // making the invoice impossible to finish by card. A unique value per
    // attempt sidesteps that while still using the gateway's real `given_id`
    // mechanism (vs the unsupported Idempotency-Key header).
    const givenId = randomUUID();
    let moyasarPayment: Awaited<ReturnType<MoyasarApiClient['createPayment']>>;
    try {
      moyasarPayment = await this.moyasar.createPayment(DEFAULT_ORG_ID, {
        amountHalalas,
        currency: invoice.currency,
        description: `Invoice payment - ${invoice.id}`,
        callbackUrl: this.buildCallbackUrl(invoice.bookingId ?? '', invoice.id),
        metadata: {
          invoiceId: invoice.id,
          bookingId: invoice.bookingId ?? '',
          source: 'mobile-client',
        },
        givenId,
      });
    } catch (error) {
      await this.deleteFailedPaymentInit(payment.id);
      if (error instanceof Error) {
        this.logger.error(`Moyasar payment creation failed for payment ${payment.id}`, error.stack);
      }
      throw error;
    }

    const redirectUrl = moyasarPayment.redirectUrl;
    if (!redirectUrl) {
      await this.deleteFailedPaymentInit(payment.id);
      throw new BadRequestException('Payment gateway did not return a redirect URL');
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayRef: moyasarPayment.id },
      select: { id: true },
    });

    return {
      paymentId: updatedPayment.id,
      redirectUrl,
    };
  }

  private async deleteFailedPaymentInit(paymentId: string): Promise<void> {
    try {
      await this.prisma.payment.delete({ where: { id: paymentId } });
    } catch (error) {
      this.logger.error(
        `Failed to delete client payment ${paymentId} after Moyasar failure`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private buildCallbackUrl(bookingId: string, invoiceId: string): string {
    const baseUrl = process.env['PUBLIC_WEBSITE_URL'];
    const fallbackUrl = 'http://localhost:3000';
    return `${baseUrl || fallbackUrl}/booking/payment-callback?bookingId=${bookingId}&invoiceId=${invoiceId}`;
  }
}
