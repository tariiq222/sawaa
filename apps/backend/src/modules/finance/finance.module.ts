import { Module, OnModuleInit } from '@nestjs/common';
import { DashboardFinanceController } from '../../api/dashboard/finance.controller';
import { RefundsController } from '../../api/dashboard/refunds.controller';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { PaymentsInfraModule } from '../../infrastructure/payments/payments.module';
import { StorageModule } from '../../infrastructure/storage';
import { OrgExperienceModule } from '../org-experience/org-experience.module';
import { CreateInvoiceHandler } from './create-invoice/create-invoice.handler';
import { BookingConfirmedHandler } from './create-invoice/booking-confirmed.handler';
import { ProcessPaymentHandler } from './process-payment/process-payment.handler';
import { MoyasarWebhookHandler } from './moyasar-webhook/moyasar-webhook.handler';
import { BankTransferUploadHandler } from './bank-transfer-upload/bank-transfer-upload.handler';
import { ApplyCouponHandler } from './apply-coupon/apply-coupon.handler';
import { GetInvoiceHandler } from './get-invoice/get-invoice.handler';
import { GetPublicInvoiceHandler } from './get-invoice/get-public-invoice.handler';
import { GetBookingInvoiceHandler } from './get-invoice/get-booking-invoice.handler';
import { ListPaymentsHandler } from './list-payments/list-payments.handler';
import { ListCouponsHandler } from './coupons/list-coupons.handler';
import { GetCouponHandler } from './coupons/get-coupon.handler';
import { CreateCouponHandler } from './coupons/create-coupon.handler';
import { UpdateCouponHandler } from './coupons/update-coupon.handler';
import { DeleteCouponHandler } from './coupons/delete-coupon.handler';
import { GetPaymentStatsHandler } from './get-payment-stats/get-payment-stats.handler';
import { RefundPaymentHandler } from './refund-payment/refund-payment.handler';
import { VerifyPaymentHandler } from './verify-payment/verify-payment.handler';
import { GroupSessionReadyHandler } from './group-session-ready/group-session-ready.handler';
import { MoyasarApiClient } from './moyasar-api/moyasar-api.client';

import { InitGuestPaymentHandler } from './payments/public/init-guest-payment/init-guest-payment.handler';
import { InitClientPaymentHandler } from './payments/client/init-client-payment/init-client-payment.handler';
import { RequestRefundHandler } from './refund-payment/request-refund.handler';
import { ApproveRefundHandler } from './refund-payment/approve-refund.handler';
import { DenyRefundHandler } from './refund-payment/deny-refund.handler';
import { ListRefundsHandler } from './refund-payment/list-refunds.handler';
import { GetMoyasarConfigHandler } from './moyasar-config/get-moyasar-config.handler';
import { UpsertMoyasarConfigHandler } from './moyasar-config/upsert-moyasar-config.handler';
import { TestMoyasarConfigHandler } from './moyasar-config/test-moyasar-config.handler';
import { OnBookingCancelledRefundHandler } from './events/on-booking-cancelled.handler';
import { CreateBundlePurchaseHandler } from './bundle-purchases/create-bundle-purchase.handler';
import { UseBundleHandler } from './bundle-purchases/use-bundle.handler';
import { ListClientBundlePurchasesHandler } from './bundle-purchases/list-client-bundle-purchases.handler';

const handlers = [
  CreateInvoiceHandler,
  ProcessPaymentHandler,
  MoyasarWebhookHandler,
  BankTransferUploadHandler,
  ApplyCouponHandler,
  GetInvoiceHandler,
  GetPublicInvoiceHandler,
  GetBookingInvoiceHandler,
  ListPaymentsHandler,
  ListCouponsHandler,
  GetCouponHandler,
  CreateCouponHandler,
  UpdateCouponHandler,
  DeleteCouponHandler,
  GetPaymentStatsHandler,
  RefundPaymentHandler,
  VerifyPaymentHandler,
  GroupSessionReadyHandler,
  InitGuestPaymentHandler,
  InitClientPaymentHandler,
  RequestRefundHandler,
  ApproveRefundHandler,
  DenyRefundHandler,
  ListRefundsHandler,
  GetMoyasarConfigHandler,
  UpsertMoyasarConfigHandler,
  TestMoyasarConfigHandler,
  CreateBundlePurchaseHandler,
  UseBundleHandler,
  ListClientBundlePurchasesHandler,
];

@Module({
  imports: [DatabaseModule, MessagingModule, PaymentsInfraModule, StorageModule, OrgExperienceModule],
  controllers: [DashboardFinanceController, RefundsController],
  providers: [
    ...handlers,
    BookingConfirmedHandler,
    GroupSessionReadyHandler,
    MoyasarApiClient,
    OnBookingCancelledRefundHandler,
  ],
  exports: [...handlers, MoyasarApiClient],
})
export class FinanceModule implements OnModuleInit {
  constructor(
    private readonly bookingConfirmedHandler: BookingConfirmedHandler,
    private readonly groupSessionReadyHandler: GroupSessionReadyHandler,
    private readonly onBookingCancelledRefundHandler: OnBookingCancelledRefundHandler,
  ) {}

  onModuleInit(): void {
    this.bookingConfirmedHandler.register();
    this.groupSessionReadyHandler.register();
    this.onBookingCancelledRefundHandler.register();
  }
}
