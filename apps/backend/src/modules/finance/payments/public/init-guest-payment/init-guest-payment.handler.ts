import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../../infrastructure/database';
import { MoyasarApiClient } from '../../../moyasar-api/moyasar-api.client';
import { InitGuestPaymentDto } from './init-guest-payment.dto';
import { DEFAULT_ORG_ID } from '../../../../../common/constants';

export interface InitGuestPaymentResult {
  paymentId: string;
  redirectUrl: string;
}

@Injectable()
export class InitGuestPaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moyasar: MoyasarApiClient,
  ) {}

  async execute(dto: InitGuestPaymentDto): Promise<InitGuestPaymentResult> {
    const organizationId = DEFAULT_ORG_ID;
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId },
      select: { id: true, status: true, price: true, currency: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${dto.bookingId} not found`);
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
      if (!existingPayment.gatewayRef) {
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.delete({ where: { id: existingPayment.id } });
        });
      } else {
        return {
          paymentId: existingPayment.id,
          redirectUrl: '',
        };
      }
    }

    const amountHalalas = Math.round(Number(invoice.total) * 100);

    const payment = await this.prisma.$transaction(async (tx) => {
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
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.delete({ where: { id: payment.id } });
      });
      throw moyasarError;
    }

    const updatedPayment = await this.prisma.$transaction(async (tx) => {
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
      redirectUrl: moyasarPayment.redirectUrl ?? '',
    };
  }

  private buildCallbackUrl(bookingId: string): string {
    const baseUrl = process.env['PUBLIC_WEBSITE_URL'];
    return `${baseUrl || 'http://localhost:3000'}/booking/confirm?bookingId=${bookingId}`;
  }
}
