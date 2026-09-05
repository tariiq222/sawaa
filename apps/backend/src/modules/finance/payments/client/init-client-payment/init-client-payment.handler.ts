import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../../../infrastructure/database';
import { MoyasarApiClient } from '../../../moyasar-api/moyasar-api.client';
import { InitClientPaymentDto } from './init-client-payment.dto';
import { DEFAULT_ORG_ID } from '../../../../../common/constants';
import {
  reconcileOrDiscardInFlightPayment,
  persistPendingGatewayRef,
  replaceTerminalInFlightPayment,
} from './reconcile-in-flight-payment.helper';
import { isNonPayableInvoiceStatus } from '../../../invoice-payment-state.helper';

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
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: InitClientPaymentCommand): Promise<InitClientPaymentResult> {
    // Keep the cheap ownership check before configuration lookup, then repeat
    // it under the invoice lock before reserving money.
    const visibleInvoice = await this.prisma.invoice.findFirst({
      where: { id: cmd.invoiceId },
      select: { id: true, clientId: true },
    });

    if (!visibleInvoice) {
      throw new NotFoundException(`Invoice ${cmd.invoiceId} not found`);
    }
    if (visibleInvoice.clientId !== cmd.clientId) {
      throw new ForbiddenException('Invoice does not belong to this client');
    }

    const organizationSettings = await this.prisma.organizationSettings.findFirst({
      select: { paymentMoyasarEnabled: true },
    });
    if (organizationSettings?.paymentMoyasarEnabled === false) {
      throw new BadRequestException('Online payment is not enabled');
    }

    let reservation = await this.reservePayment(cmd);
    let { invoice, outstanding, payment, existing } = reservation;

    if (existing) {
      if (payment.status === PaymentStatus.COMPLETED) {
        throw new ConflictException('Payment for this invoice has already been completed');
      }
      const recovered = await this.findHostedInvoice(
        payment.id,
        payment.gatewayRef,
      );
      if (!recovered) {
        // Releases before hosted checkout stored a Moyasar Payment ID in
        // gatewayRef. Reconcile that legacy attempt before replacing it so a
        // live or paid charge cannot be duplicated.
        await reconcileOrDiscardInFlightPayment(
          this.prisma,
          this.moyasar,
          this.logger,
          payment,
          {
            alreadyPaid: 'Payment for this invoice has already been completed',
            inFlight:
              'هناك دفعة قيد التنفيذ لهذه الفاتورة، أكمل الدفع الحالي أو انتظر انتهاء الجلسة',
          },
        );
      } else {
        this.assertHostedInvoiceMatches(recovered, outstanding, invoice.currency);
        if (this.isPaidCheckoutStatus(recovered.status)) {
          throw new ConflictException('Payment for this invoice has already been completed');
        }
        if (!this.isTerminalFailedCheckoutStatus(recovered.status)) {
          if (payment.gatewayRef !== recovered.id) {
            await persistPendingGatewayRef(
              this.rlsTransaction,
              invoice.id,
              payment,
              recovered.id,
            );
          }
          if (!recovered.url) {
            throw new ConflictException('Payment checkout exists but has no hosted URL');
          }
          return { paymentId: payment.id, redirectUrl: recovered.url };
        }
      }

      reservation = await replaceTerminalInFlightPayment(
        this.rlsTransaction,
        invoice.id,
        payment,
        (tx) => this.createReservation(tx, cmd),
      );
      ({ invoice, outstanding, payment, existing } = reservation);
      if (existing) {
        throw new ConflictException('تعذّر حجز دفعة جديدة لهذه الفاتورة، حاول مرة أخرى لاحقاً');
      }
    }

    // invoice.total and Payment.amount are both stored in halalas — bill the
    // outstanding remainder verbatim.
    const amountHalalas = outstanding;

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
    await persistPendingGatewayRef(
      this.rlsTransaction,
      invoice.id,
      payment,
      checkout.id,
    );
    if (this.isPaidCheckoutStatus(checkout.status)) {
      throw new ConflictException('Payment for this invoice has already been completed');
    }
    if (!checkout.url) {
      throw new BadRequestException('Payment gateway did not return a redirect URL');
    }

    return {
      paymentId: payment.id,
      redirectUrl: checkout.url,
    };
  }

  private async reservePayment(cmd: InitClientPaymentCommand) {
    const reserve = async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${cmd.invoiceId} FOR UPDATE`,
      );
      return this.createReservation(tx, cmd);
    };

    try {
      return await this.rlsTransaction.withTransaction(reserve);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      // A concurrent initializer won the idempotency key. The failed tx has
      // rolled back; re-enter under the invoice lock and reconcile its row.
      return this.rlsTransaction.withTransaction(reserve);
    }
  }

  private async createReservation(tx: Prisma.TransactionClient, cmd: InitClientPaymentCommand) {
      const invoice = await tx.invoice.findFirst({
        where: { id: cmd.invoiceId },
        select: {
          id: true,
          clientId: true,
          bookingId: true,
          total: true,
          currency: true,
          status: true,
        },
      });
      if (!invoice) {
        throw new NotFoundException(`Invoice ${cmd.invoiceId} not found`);
      }
      if (invoice.clientId !== cmd.clientId) {
        throw new ForbiddenException('Invoice does not belong to this client');
      }
      if (isNonPayableInvoiceStatus(invoice.status as InvoiceStatus)) {
        throw new BadRequestException(
          `Invoice ${invoice.id} cannot accept payments (status: ${invoice.status})`,
        );
      }

      if (invoice.bookingId) {
        const booking = await tx.booking.findFirst({
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

      const previouslyPaid = await tx.payment.aggregate({
        where: { invoiceId: invoice.id, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      });
      const alreadyPaid = Number(previouslyPaid._sum?.amount ?? 0);
      const outstanding = Math.round(Number(invoice.total)) - alreadyPaid;
      if (outstanding <= 0) {
        throw new BadRequestException('Invoice is already fully paid');
      }

      const idempotencyKey = `client:${invoice.id}`;
      const existingPayment = await tx.payment.findFirst({
        where: { idempotencyKey },
        select: { id: true, status: true, gatewayRef: true },
      });
      if (existingPayment) {
        return { invoice, outstanding, payment: existingPayment, existing: true as const };
      }

      const competingReservation = await tx.payment.findFirst({
        where: {
          invoiceId: invoice.id,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.PENDING_VERIFICATION] },
        },
        select: { id: true, status: true },
      });
      if (competingReservation) {
        throw new ConflictException('Invoice has another payment pending completion or verification');
      }

      const payment = await tx.payment.create({
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
      return {
        invoice,
        outstanding,
        payment: { ...payment, status: PaymentStatus.PENDING, gatewayRef: null },
        existing: false as const,
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
