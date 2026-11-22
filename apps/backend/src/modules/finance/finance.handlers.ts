/**
 * Finance handler roster, kept out of the module file so it stays inside the
 * 120-line budget (MNT-20). Registration order is unchanged; this file holds
 * no logic and no wiring — only the list.
 */
import { RecordPreviousReceiptHandler } from './record-previous-receipt/record-previous-receipt.handler';
import { GetNativePaymentConfigHandler } from './native-payments/get-native-payment-config/get-native-payment-config.handler';
import { InitNativePaymentHandler } from './native-payments/init-native-payment/init-native-payment.handler';
import { ReconcileNativePaymentHandler } from './native-payments/reconcile-native-payment/reconcile-native-payment.handler';
import { InitNativePackagePurchaseHandler } from './package-purchases/init-package-purchase/init-native-package-purchase.handler';
import { MoyasarPaymentSettlementHandler } from './moyasar-payment-settlement/moyasar-payment-settlement.handler';
import { CreateInvoiceHandler } from './create-invoice/create-invoice.handler';
import { ProcessPaymentHandler } from './process-payment/process-payment.handler';
import { MoyasarWebhookHandler } from './moyasar-webhook/moyasar-webhook.handler';
import { BankTransferUploadHandler } from './bank-transfer-upload/bank-transfer-upload.handler';
import { ApplyCouponHandler } from './apply-coupon/apply-coupon.handler';
import { GetInvoiceHandler } from './get-invoice/get-invoice.handler';
import { GetPublicInvoiceHandler } from './get-invoice/get-public-invoice.handler';
import { GetBookingInvoiceHandler } from './get-invoice/get-booking-invoice.handler';
import { ListClientInvoicesHandler } from './list-client-invoices/list-client-invoices.handler';
import { ListPaymentsHandler } from './list-payments/list-payments.handler';
import { GetPaymentHandler } from './get-payment/get-payment.handler';
import { ListInvoicesHandler } from './list-invoices/list-invoices.handler';
import { ListCouponsHandler } from './coupons/list-coupons.handler';
import { GetCouponHandler } from './coupons/get-coupon.handler';
import { CreateCouponHandler } from './coupons/create-coupon.handler';
import { UpdateCouponHandler } from './coupons/update-coupon.handler';
import { DeleteCouponHandler } from './coupons/delete-coupon.handler';
import { GetPaymentStatsHandler } from './get-payment-stats/get-payment-stats.handler';
import { GetEmployeeEarningsHandler } from './get-employee-earnings/get-employee-earnings.handler';
import { RefundPaymentHandler } from './refund-payment/refund-payment.handler';
import { ManualRefundPaymentHandler } from './refund-payment/manual-refund-payment.handler';
import { VerifyPaymentHandler } from './verify-payment/verify-payment.handler';
import { InitClientPaymentHandler } from './payments/client/init-client-payment/init-client-payment.handler';
import { GetPublicPaymentMethodsHandler } from './payments/public/get-public-payment-methods/get-public-payment-methods.handler';
import { RequestRefundHandler } from './refund-payment/request-refund.handler';
import { CreatePackagePurchaseHandler } from './package-purchases/create-package-purchase/create-package-purchase.handler';
import { ListClientPackagePurchasesHandler } from './package-purchases/list-client-package-purchases/list-client-package-purchases.handler';
import { RefundPackagePurchaseHandler } from './package-purchases/refund-package-purchase/refund-package-purchase.handler';
import { InitPackagePurchaseHandler } from './package-purchases/init-package-purchase/init-package-purchase.handler';
import { ActivatePackagePurchaseHandler } from './package-purchases/activate-package-purchase/activate-package-purchase.handler';
import { ApproveRefundHandler } from './refund-payment/approve-refund.handler';
import { DenyRefundHandler } from './refund-payment/deny-refund.handler';
import { ListRefundsHandler } from './refund-payment/list-refunds.handler';
import { GetMoyasarConfigHandler } from './moyasar-config/get-moyasar-config.handler';
import { UpsertMoyasarConfigHandler } from './moyasar-config/upsert-moyasar-config.handler';
import { TestMoyasarConfigHandler } from './moyasar-config/test-moyasar-config.handler';
import { GenerateInvoicePdfHandler } from './generate-invoice-pdf/generate-invoice-pdf.handler';
import { ApplyInvoiceDiscountHandler } from './apply-invoice-discount/apply-invoice-discount.handler';
import { EnsureBookingInvoiceHandler } from './ensure-booking-invoice/ensure-booking-invoice.handler';
import { CollectBookingPaymentHandler } from './collect-booking-payment/collect-booking-payment.handler';

export const financeHandlers = [
  RecordPreviousReceiptHandler,
  GetNativePaymentConfigHandler, InitNativePaymentHandler, ReconcileNativePaymentHandler, InitNativePackagePurchaseHandler, MoyasarPaymentSettlementHandler,
  CreateInvoiceHandler,
  EnsureBookingInvoiceHandler,
  CollectBookingPaymentHandler,
  GenerateInvoicePdfHandler,
  ProcessPaymentHandler,
  ApplyInvoiceDiscountHandler,
  MoyasarWebhookHandler,
  BankTransferUploadHandler,
  ApplyCouponHandler,
  GetInvoiceHandler,
  GetPublicInvoiceHandler,
  GetBookingInvoiceHandler,
  ListClientInvoicesHandler,
  ListPaymentsHandler,
  GetPaymentHandler,
  ListInvoicesHandler,
  ListCouponsHandler,
  GetCouponHandler,
  CreateCouponHandler,
  UpdateCouponHandler,
  DeleteCouponHandler,
  GetPaymentStatsHandler,
  GetEmployeeEarningsHandler,
  RefundPaymentHandler,
  ManualRefundPaymentHandler,
  VerifyPaymentHandler,
  InitClientPaymentHandler,
  GetPublicPaymentMethodsHandler,
  RequestRefundHandler,
  ApproveRefundHandler,
  DenyRefundHandler,
  ListRefundsHandler,
  GetMoyasarConfigHandler,
  UpsertMoyasarConfigHandler,
  TestMoyasarConfigHandler,
  CreatePackagePurchaseHandler,
  ListClientPackagePurchasesHandler,
  RefundPackagePurchaseHandler,
  InitPackagePurchaseHandler,
  ActivatePackagePurchaseHandler,
];
