import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { captureCancellationRefundOutcome } from '../cancellation-refund/capture-cancellation-refund-outcome';
import { RlsTransactionService } from '../../../infrastructure/database';

export interface DenyRefundCommand {
  refundRequestId: string;
  deniedBy: string;
  reason: string;
}

@Injectable()
export class DenyRefundHandler {
  constructor(private readonly rls: RlsTransactionService) {}

  async execute(cmd: DenyRefundCommand) {
    return this.rls.withTransaction(async tx => {
      const refundRequest = await tx.refundRequest.findFirst({
        where: { id: cmd.refundRequestId, status: 'PENDING_REVIEW' },
      });
      if (!refundRequest) throw new NotFoundException('Refund request not found or not pending review');
      const denied = await tx.refundRequest.update({
        where: { id: cmd.refundRequestId, status: 'PENDING_REVIEW' },
        data: { status: 'DENIED', processedBy: cmd.deniedBy, processedAt: new Date(), denialReason: cmd.reason },
      });
      await captureCancellationRefundOutcome(tx, cmd.refundRequestId);
      return denied;
    });
  }
}
