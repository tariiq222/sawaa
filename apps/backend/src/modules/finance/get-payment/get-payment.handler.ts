import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetPaymentQuery {
  paymentId: string;
}

@Injectable()
export class GetPaymentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetPaymentQuery) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: query.paymentId },
      include: {
        invoice: {
          select: {
            bookingId: true,
            clientId: true,
            total: true,
          },
        },
        refundRequests: {
          select: {
            id: true,
            amount: true,
            status: true,
            reason: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const client = payment.invoice?.clientId
      ? await this.prisma.client.findUnique({
          where: { id: payment.invoice.clientId },
          select: { id: true, name: true, firstName: true, lastName: true, phone: true },
        })
      : null;

    return {
      ...payment,
      invoice: payment.invoice
        ? {
            ...payment.invoice,
            client,
          }
        : null,
    };
  }
}
