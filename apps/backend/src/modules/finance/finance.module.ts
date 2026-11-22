import { PreviousReceiptRecordedAuditHandler } from './events/previous-receipt-recorded-audit.handler';
import { CancellationRefundIntentService } from './cancellation-refund/cancellation-refund-intent.service';
import { Module, OnModuleInit } from '@nestjs/common';
import { financeHandlers } from './finance.handlers';
import { DashboardFinanceController } from '../../api/dashboard/finance.controller';
import { RefundsController } from '../../api/dashboard/refunds.controller';
import { DatabaseModule } from '../../infrastructure/database';
import { EmailModule } from '../../infrastructure/email/email.module';
import { EventBusService } from '../../infrastructure/events/event-bus.service';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { PaymentsInfraModule } from '../../infrastructure/payments/payments.module';
import { StorageModule } from '../../infrastructure/storage';
import { TelemetryModule } from '../../infrastructure/telemetry/telemetry.module';
import { OrgExperienceModule } from '../org-experience/org-experience.module';
import { BookingConfirmedHandler } from './create-invoice/booking-confirmed.handler';
import { MoyasarApiClient } from './moyasar-api/moyasar-api.client';

import { ActivatePackagePurchaseHandler } from './package-purchases/activate-package-purchase/activate-package-purchase.handler';
import { OnBookingCancelledRefundHandler } from './events/on-booking-cancelled.handler';
import { OnBookingCancelApprovedRefundHandler } from './events/on-booking-cancel-approved.handler';
import { IssueInvoiceReceiptHandler } from './issue-invoice-receipt/issue-invoice-receipt.handler';
import { SendInvoiceReceiptHandler } from './issue-invoice-receipt/send-invoice-receipt.handler';
import { InvoicePdfRendererService } from './issue-invoice-receipt/invoice-pdf-renderer.service';
import { BookingFinanceLedgerService } from './booking-finance/booking-finance-ledger.service';
import { PackageLedgerModule } from '../bookings/package-ledger/package-ledger.module';

@Module({
  imports: [DatabaseModule, MessagingModule, PaymentsInfraModule, StorageModule, OrgExperienceModule, EmailModule, TelemetryModule, PackageLedgerModule],
  controllers: [DashboardFinanceController, RefundsController],
  providers: [
    PreviousReceiptRecordedAuditHandler,
    ...financeHandlers,
    BookingConfirmedHandler,
    MoyasarApiClient,
    OnBookingCancelledRefundHandler,
    CancellationRefundIntentService,
    OnBookingCancelApprovedRefundHandler,
    IssueInvoiceReceiptHandler,
    SendInvoiceReceiptHandler,
    InvoicePdfRendererService,
    BookingFinanceLedgerService,
  ],
  exports: [...financeHandlers, MoyasarApiClient, InvoicePdfRendererService, BookingFinanceLedgerService],
})
export class FinanceModule implements OnModuleInit {
  constructor(
    private readonly bookingConfirmedHandler: BookingConfirmedHandler,
    private readonly onBookingCancelledRefundHandler: OnBookingCancelledRefundHandler,
    private readonly onBookingCancelApprovedRefundHandler: OnBookingCancelApprovedRefundHandler,
    private readonly issueInvoiceReceiptHandler: IssueInvoiceReceiptHandler,
    private readonly sendInvoiceReceiptHandler: SendInvoiceReceiptHandler,
    private readonly activatePackagePurchaseHandler: ActivatePackagePurchaseHandler,
    private readonly eventBus: EventBusService,
    private readonly previousReceiptRecordedAuditHandler: PreviousReceiptRecordedAuditHandler,
  ) {}

  onModuleInit(): void {
    this.previousReceiptRecordedAuditHandler.register();
    this.bookingConfirmedHandler.register();
    this.onBookingCancelledRefundHandler.register();
    this.onBookingCancelApprovedRefundHandler.register();
    this.issueInvoiceReceiptHandler.register();
    this.sendInvoiceReceiptHandler.register(this.eventBus);
    // Phase 4 self-purchase: activate a PENDING package purchase + issue its
    // credits when its Moyasar payment completes. Subscribes to the SAME
    // finance.payment.completed event the (unchanged) webhook already emits.
    this.activatePackagePurchaseHandler.register();
  }
}
