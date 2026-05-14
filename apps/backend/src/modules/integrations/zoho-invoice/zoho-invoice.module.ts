import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { MessagingModule } from '../../../infrastructure/messaging.module';
import { TenantModule } from '../../../common/tenant';
import { ZohoInfrastructureModule } from '../../../infrastructure/zoho/zoho-infrastructure.module';
import { DashboardZohoController } from '../../../api/dashboard/zoho.controller';

import { ZohoConfigService } from './zoho-config.service';
import { StartConnectHandler } from './connect/start-connect.handler';
import { OAuthCallbackHandler } from './connect/oauth-callback.handler';
import { SelectOrganizationHandler } from './connect/select-organization.handler';
import { DisconnectHandler } from './connect/disconnect.handler';
import { GetZohoConfigHandler } from './config/get-zoho-config.handler';
import { UpdateZohoConfigHandler } from './config/update-zoho-config.handler';
import { TestZohoConfigHandler } from './config/test-zoho-config.handler';
import { UpsertContactHandler } from './contacts/upsert-contact.handler';
import { CreateZohoInvoiceHandler } from './invoices/create-invoice.handler';
import { ListZohoInvoicesHandler } from './invoices/list-invoices.handler';
import { GetZohoInvoiceHandler } from './invoices/get-invoice.handler';
import { SendZohoInvoiceHandler } from './invoices/send-invoice.handler';
import { VoidZohoInvoiceHandler } from './invoices/void-invoice.handler';
import { PaymentCapturedEventHandler } from './invoices/payment-captured.event-handler';
import { RecordPaymentHandler } from './payments/record-payment.handler';
import { ListPaymentMirrorsHandler } from './payments/list-payment-mirrors.handler';
import { CreateCreditNoteHandler } from './credit-notes/create-credit-note.handler';
import { RefundCompletedEventHandler } from './credit-notes/refund-completed.event-handler';
import { HandleZohoWebhookHandler } from './webhooks/handle-event.handler';

const handlers = [
  ZohoConfigService,
  StartConnectHandler,
  OAuthCallbackHandler,
  SelectOrganizationHandler,
  DisconnectHandler,
  GetZohoConfigHandler,
  UpdateZohoConfigHandler,
  TestZohoConfigHandler,
  UpsertContactHandler,
  CreateZohoInvoiceHandler,
  ListZohoInvoicesHandler,
  GetZohoInvoiceHandler,
  SendZohoInvoiceHandler,
  VoidZohoInvoiceHandler,
  RecordPaymentHandler,
  ListPaymentMirrorsHandler,
  CreateCreditNoteHandler,
  HandleZohoWebhookHandler,
  PaymentCapturedEventHandler,
  RefundCompletedEventHandler,
];

@Module({
  imports: [DatabaseModule, MessagingModule, TenantModule, ZohoInfrastructureModule],
  controllers: [DashboardZohoController],
  providers: handlers,
  exports: handlers,
})
export class ZohoInvoiceModule implements OnModuleInit {
  constructor(
    private readonly paymentCaptured: PaymentCapturedEventHandler,
    private readonly refundCompleted: RefundCompletedEventHandler,
  ) {}

  onModuleInit(): void {
    this.paymentCaptured.register();
    this.refundCompleted.register();
  }
}
