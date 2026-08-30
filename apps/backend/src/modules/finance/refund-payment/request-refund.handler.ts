import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface RequestRefundCommand {
  invoiceId: string;
  clientId: string;
  reason?: string;
}

export interface RefundRequestResult {
  id: string;
  status: string;
  amount: number;
  createdAt: string;
}

@Injectable()
export class RequestRefundHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: RequestRefundCommand): Promise<RefundRequestResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: cmd.invoiceId,
        clientId: cmd.clientId,
      },
      include: {
        payments: {
          where: {
            status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
          },
          orderBy: { processedAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (!['PAID', 'PARTIALLY_REFUNDED'].includes(invoice.status)) {
      throw new BadRequestException('Only paid invoices can be refunded');
    }

    const refundablePayment = invoice.payments.find((payment) => {
      const amount = Number(payment.amount);
      const refundedAmount = Number(payment.refundedAmount ?? 0);
      return amount - refundedAmount > 0;
    });
    if (!refundablePayment) {
      throw new BadRequestException('No completed payment found for this invoice');
    }

    const existingRequest = await this.prisma.refundRequest.findFirst({
      where: {
        invoiceId: cmd.invoiceId,
        status: { in: ['PENDING_REVIEW', 'APPROVED', 'PROCESSING'] },
      },
    });

    if (
      existingRequest &&
      (!existingRequest.status || ['PENDING_REVIEW', 'APPROVED', 'PROCESSING'].includes(existingRequest.status))
    ) {
      throw new ConflictException('A refund request already exists for this invoice');
    }

    const refundableAmount =
      Number(refundablePayment.amount) - Number(refundablePayment.refundedAmount ?? 0);

    const refundRequest = await this.prisma.refundRequest.create({
      data: {
        invoiceId: cmd.invoiceId,
        paymentId: refundablePayment.id,
        clientId: cmd.clientId,
        amount: refundableAmount,
        reason: cmd.reason,
        status: 'PENDING_REVIEW',
      },
    });

    return {
      id: refundRequest.id,
      status: refundRequest.status,
      amount: Number(refundRequest.amount),
      createdAt: refundRequest.createdAt.toISOString(),
    };
  }
}
