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
import { reconcileOrDiscardInFlightPayment } from './reconcile-in-flight-payment.helper';

const PAYMENT_INIT_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.AWAITING_PAYMENT,
  BookingStatus.DEPOSIT_PAID,
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

    const organizationSettings = await this.prisma.organizationSettings.findFirst({
      select: { paymentMoyasarEnabled: true },
    });
    if (organizationSettings?.paymentMoyasarEnabled === false) {
      throw new BadRequestException('Online payment is not enabled');
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

    const idempotencyKey = `client:${invoice.id}`;
    const existingPayment = await this.prisma.payment.findFirst({
      where: { idempotencyKey },
      select: { id: true, status: true, gatewayRef: true },
    });

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.COMPLETED) {
        throw new ConflictException('Payment for this invoice has already been completed');
      }
      const recovered = await this.findHostedInvoice(
        existingPayment.id,
        existingPayment.gatewayRef,
      );
      if (!recovered) {
        // Releases before hosted checkout stored a Moyasar Payment ID in
        // gatewayRef. Reconcile that legacy attempt before replacing it so a
        // live or paid charge cannot be duplicated.
        await reconcileOrDiscardInFlightPayment(
          this.prisma,
          this.moyasar,
          this.logger,
          existingPayment,
          {
            alreadyPaid: 'Payment for this invoice has already been completed',
            inFlight:
              'هناك دفعة قيد التنفيذ لهذه الفاتورة، أكمل الدفع الحالي أو انتظر انتهاء الجلسة',
          },
        );
      } else {
        this.assertHostedInvoiceMatches(recovered, outstanding, invoice.currency);
        if (existingPayment.gatewayRef !== recovered.id) {
          await this.prisma.payment.update({
            where: { id: existingPayment.id },
            data: { gatewayRef: recovered.id },
            select: { id: true },
          });
        }
        if (this.isPaidCheckoutStatus(recovered.status)) {
          throw new ConflictException('Payment for this invoice has already been completed');
        }
        if (!this.isTerminalFailedCheckoutStatus(recovered.status)) {
          if (!recovered.url) {
            throw new ConflictException('Payment checkout exists but has no hosted URL');
          }
          return { paymentId: existingPayment.id, redirectUrl: recovered.url };
        }
        await this.prisma.payment.delete({ where: { id: existingPayment.id } });
      }
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

    let checkout: Awaited<ReturnType<MoyasarApiClient['createCheckoutInvoice']>>;
    try {
      checkout = await this.moyasar.createCheckoutInvoice(DEFAULT_ORG_ID, {
        amountHalalas,
        currency: invoice.currency,
        description: `Invoice payment - ${invoice.id}`,
        successUrl: this.buildCallbackUrl(invoice.bookingId ?? '', invoice.id),
        backUrl: this.buildCallbackUrl(invoice.bookingId ?? '', invoice.id),
        metadata: {
          invoiceId: invoice.id,
          bookingId: invoice.bookingId ?? '',
          source: 'mobile-client',
          internalPaymentId: payment.id,
        },
      });
    } catch (error) {
      const recovered = await this.findHostedInvoice(payment.id, null);
      if (!recovered) {
        if (error instanceof Error) {
          this.logger.error(
            `Moyasar hosted invoice creation outcome is unknown for payment ${payment.id}`,
            error.stack,
          );
        }
        throw error;
      }
      checkout = recovered;
    }

    this.assertHostedInvoiceMatches(checkout, amountHalalas, invoice.currency);
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayRef: checkout.id },
      select: { id: true },
    });
    if (this.isPaidCheckoutStatus(checkout.status)) {
      throw new ConflictException('Payment for this invoice has already been completed');
    }
    if (!checkout.url) {
      throw new BadRequestException('Payment gateway did not return a redirect URL');
    }

    return {
      paymentId: updatedPayment.id,
      redirectUrl: checkout.url,
    };
  }

  private async findHostedInvoice(paymentId: string, gatewayRef: string | null) {
    try {
      if (gatewayRef) {
        try {
          return await this.moyasar.getCheckoutInvoice(DEFAULT_ORG_ID, gatewayRef);
        } catch (error) {
          if (!(error instanceof NotFoundException)) throw error;
          // The stored reference may be missing after an unknown create/update
          // boundary. Metadata is the durable recovery identity.
        }
      }
      return await this.moyasar.findCheckoutInvoiceByMetadata(
        DEFAULT_ORG_ID,
        paymentId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to reconcile hosted invoice for payment ${paymentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ConflictException('تعذّر التحقق من حالة الدفعة الجارية، حاول مرة أخرى لاحقاً');
    }
  }

  private assertHostedInvoiceMatches(
    checkout: { amount: number; currency: string },
    amountHalalas: number,
    currency: string,
  ): void {
    if (
      Math.round(checkout.amount) !== amountHalalas ||
      checkout.currency.toUpperCase() !== currency.toUpperCase()
    ) {
      throw new ConflictException('Hosted invoice does not match the payment attempt');
    }
  }

  private isPaidCheckoutStatus(status: string): boolean {
    return ['paid', 'completed'].includes(status.toLowerCase());
  }

  private isTerminalFailedCheckoutStatus(status: string): boolean {
    return ['expired', 'failed', 'canceled', 'cancelled', 'voided', 'refunded'].includes(
      status.toLowerCase(),
    );
  }

  private buildCallbackUrl(bookingId: string, invoiceId: string): string {
    const baseUrl = process.env['PUBLIC_WEBSITE_URL'];
    const fallbackUrl = 'http://localhost:3000';
    return `${baseUrl || fallbackUrl}/booking/payment-callback?bookingId=${bookingId}&invoiceId=${invoiceId}`;
  }
}
