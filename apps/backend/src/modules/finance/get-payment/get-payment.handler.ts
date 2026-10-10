import { Injectable, NotFoundException } from '@nestjs/common';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { PrismaService } from '../../../infrastructure/database';

export interface GetPaymentQuery {
  paymentId: string;
}

@Injectable()
export class GetPaymentHandler {
  constructor(private readonly prisma: PrismaService, private readonly storage: MinioService) {}

  async execute(query: GetPaymentQuery) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: query.paymentId },
      include: {
        invoice: {
          select: {
            number: true,
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

    let receiptUrl = payment.receiptUrl;
    if (receiptUrl) {
      const path = receiptUrl.startsWith("http") ? new URL(receiptUrl).pathname : receiptUrl;
      const marker = "finance-receipts/";
      const index = path.indexOf(marker);
      const key = index >= 0 ? path.slice(index + marker.length) : path.replace(/^\//, "");
      receiptUrl = await this.storage.getSignedUrl("finance-receipts", key);
    }

    return {
      ...payment,
      receiptUrl,
      invoice: payment.invoice
        ? {
            ...payment.invoice,
            client,
          }
        : null,
    };
  }
}
