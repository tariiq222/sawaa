import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../../../infrastructure/database';
import { MoyasarApiClient } from '../../../moyasar-api/moyasar-api.client';
import { InitGuestPaymentDto } from './init-guest-payment.dto';
import { DEFAULT_ORG_ID } from '../../../../../common/constants';

export interface InitGuestPaymentResult {
  paymentId: string;
  redirectUrl: string;
}

export type InitGuestPaymentCommand = InitGuestPaymentDto & {
  /**
   * SECURITY (P0-9): identifier (phone/email) extracted from the OTP session
   * by the controller. MUST equal the booking client's phone or email, or the
   * request is rejected as a session-replay against a different booking.
   */
  otpIdentifier: string;
  /**
   * SECURITY (P0-9): jti of the OTP session. Marked consumed atomically after
   * Moyasar accepts the payment so the same session cannot init a second one.
   */
  otpJti: string;
};

@Injectable()
export class InitGuestPaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly moyasar: MoyasarApiClient,
  ) {}

  async execute(dto: InitGuestPaymentCommand): Promise<InitGuestPaymentResult> {
    const organizationId = DEFAULT_ORG_ID;
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId },
      select: { id: true, status: true, price: true, currency: true, clientId: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${dto.bookingId} not found`);
    }

    // SECURITY (P0-9): the OTP session must belong to the booking owner.
    const client = await this.prisma.client.findFirst({
      where: { id: booking.clientId },
      select: { phone: true, email: true },
    });
    const id = dto.otpIdentifier;
    const matches = !!client && (client.phone === id || client.email === id);
    if (!matches) {
      throw new ForbiddenException('OTP session does not match booking');
    }

    if (booking.status !== 'AWAITING_PAYMENT') {
      throw new BadRequestException(
        `Booking ${dto.bookingId} is not awaiting payment (status: ${booking.status})`,
      );
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { bookingId: dto.bookingId },
      select: { id: true, total: true, currency: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice not found for booking ${dto.bookingId}`);
    }

    const existingPayment = await this.prisma.payment.findFirst({
      where: { idempotencyKey: `guest:${dto.bookingId}` },
    });

    if (existingPayment) {
      if (existingPayment.status === 'COMPLETED') {
        throw new ConflictException('Payment for this booking has already been completed');
      }
      // P1-7 mitigation: delete any non-completed payment (with or without gatewayRef)
      // and create a fresh one so the user always receives a valid redirectUrl.
      await this.rlsTransaction.withTransaction(async (tx) => {
        await tx.payment.delete({ where: { id: existingPayment.id } });
      });
    }

    // invoice.total is already stored in halalas — send it to Moyasar verbatim.
    const amountHalalas = Math.round(Number(invoice.total));

    const payment = await this.rlsTransaction.withTransaction(async (tx) => {
      return tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: invoice.total,
          currency: invoice.currency,
          method: 'ONLINE_CARD',
          status: 'PENDING',
          idempotencyKey: `guest:${dto.bookingId}`,
        },
        select: { id: true },
      });
    });

    let moyasarPayment: Awaited<ReturnType<MoyasarApiClient['createPayment']>>;
    try {
      moyasarPayment = await this.moyasar.createPayment(organizationId, {
        amountHalalas,
        currency: invoice.currency,
        description: `Booking payment - ${dto.bookingId}`,
        callbackUrl: this.buildCallbackUrl(dto.bookingId),
        metadata: {
          invoiceId: invoice.id,
          bookingId: dto.bookingId,
        },
        idempotencyKey: `payment:${organizationId}:${invoice.id}`,
      });
    } catch (moyasarError) {
      await this.rlsTransaction.withTransaction(async (tx) => {
        await tx.payment.delete({ where: { id: payment.id } });
      });
      throw moyasarError;
    }

    const redirectUrl = moyasarPayment.redirectUrl;
    if (!redirectUrl) {
      await this.rlsTransaction.withTransaction(async (tx) => {
        await tx.payment.delete({ where: { id: payment.id } });
      });
      throw new BadRequestException('Payment gateway did not return a redirect URL');
    }

    const updatedPayment = await this.rlsTransaction.withTransaction(async (tx) => {
      // SECURITY (P0-9): consume the OTP jti atomically. If the same session
      // is replayed, the unique constraint on UsedOtpSession.jti rejects it.
      try {
        // 30m mirrors the OTP session TTL — long enough for replay protection,
        // short enough for the table to be swept by the periodic cleanup job.
        const expiresAt = new Date(Date.now() + 30 * 60_000);
        await tx.usedOtpSession.create({ data: { jti: dto.otpJti, expiresAt } });
      } catch {
        // Already consumed (concurrent caller won) — refuse to mint a second payment.
        await tx.payment.delete({ where: { id: payment.id } });
        throw new ConflictException('OTP session already consumed');
      }
      return tx.payment.update({
        where: { id: payment.id },
        data: {
          gatewayRef: moyasarPayment.id,
        },
        select: { id: true },
      });
    });

    return {
      paymentId: updatedPayment.id,
      redirectUrl,
    };
  }

  private buildCallbackUrl(bookingId: string): string {
    const baseUrl = process.env['PUBLIC_WEBSITE_URL'];
    return `${baseUrl || 'http://localhost:3000'}/booking/confirm?bookingId=${bookingId}`;
  }
}
