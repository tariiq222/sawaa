import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { PaymentsInfraModule } from '../../infrastructure/payments/payments.module';
import { RefundsController } from '../../api/dashboard/refunds.controller';
import { ListRefundsHandler } from './refund-payment/list-refunds.handler';
import { ApproveRefundHandler } from './refund-payment/approve-refund.handler';
import { DenyRefundHandler } from './refund-payment/deny-refund.handler';
import { MoyasarApiClient } from './moyasar-api/moyasar-api.client';

@Module({
  imports: [DatabaseModule, PaymentsInfraModule],
  controllers: [RefundsController],
  providers: [ListRefundsHandler, ApproveRefundHandler, DenyRefundHandler, MoyasarApiClient],
  exports: [ListRefundsHandler, ApproveRefundHandler, DenyRefundHandler],
})
export class RefundsModule {}