import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RefundStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { decimalToHalalas } from '../money.helper';
import { RefundPaymentHandler } from './refund-payment.handler';

export interface ApproveRefundCommand {
  refundRequestId: string;
  approvedBy: string;
}

export interface RefundApprovalResult {
  id: string;
  status: string;
  gatewayRef?: string;
}

/**
 * Moves a reviewed request into the same durable provider state machine used
 * by automatic cancellation refunds. No provider call is made here: the
 * RefundPaymentHandler owns the exclusive lease, cumulative-refund checks,
 * reconciliation and accounting transaction for every Moyasar refund.
 */
@Injectable()
export class ApproveRefundHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refunds: RefundPaymentHandler,
  ) {}

  async execute(cmd: ApproveRefundCommand): Promise<RefundApprovalResult> {
    const refundRequest = await this.prisma.refundRequest.findFirst({
      where: { id: cmd.refundRequestId, status: RefundStatus.PENDING_REVIEW },
    });
    if (!refundRequest) {
      throw new NotFoundException('Refund request not found or not pending review');
    }

    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: refundRequest.paymentId },
      select: { gatewayRef: true, amount: true, refundedAmount: true },
    });
    if (!payment.gatewayRef) {
      throw new NotFoundException('Payment has no gateway reference — cannot refund via Moyasar');
    }
    const refundAmount = Math.round(Number(refundRequest.amount));
    const outstanding =
      decimalToHalalas(payment.amount) - decimalToHalalas(payment.refundedAmount ?? 0);
    if (refundAmount <= 0 || refundAmount > outstanding) {
      throw new BadRequestException(
        `Refund amount ${refundAmount} exceeds the refundable balance of ${outstanding} halalas`,
      );
    }

    const requestKey = refundRequest.idempotencyKey ?? `refund:${refundRequest.id}`;
    const claimed = await this.prisma.refundRequest.updateMany({
      where: { id: cmd.refundRequestId, status: RefundStatus.PENDING_REVIEW },
      data: {
        status: RefundStatus.PROCESSING,
        processedBy: cmd.approvedBy,
        processedAt: new Date(),
        idempotencyKey: requestKey,
        providerState: 'BEFORE_CALL',
        lastProviderError: null,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException('Refund request is already being processed');
    }

    await this.refunds.finalizeRefundFromCancellation({
      refundRequestId: cmd.refundRequestId,
      idempotencyKey: requestKey,
    });
    const updated = await this.prisma.refundRequest.findUniqueOrThrow({
      where: { id: cmd.refundRequestId },
      select: { id: true, status: true, gatewayRef: true },
    });
    return {
      id: updated.id,
      status: updated.status,
      ...(updated.gatewayRef ? { gatewayRef: updated.gatewayRef } : {}),
    };
  }
}
