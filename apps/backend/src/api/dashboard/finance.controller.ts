import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile, BadRequestException, NotFoundException,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery,
  ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse, ApiResponse,
  ApiConsumes, ApiBody, ApiExtraModels, getSchemaPath,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ApiStandardResponses, ApiErrorDto } from '../../common/swagger';
import { endOfDayInTz, startOfDayInTz } from '../../common/helpers/date-tz.helper';
import { CreateInvoiceHandler } from '../../modules/finance/create-invoice/create-invoice.handler';
import { CreateInvoiceDto } from '../../modules/finance/create-invoice/create-invoice.dto';
import { GetInvoiceHandler } from '../../modules/finance/get-invoice/get-invoice.handler';
import { GenerateInvoicePdfHandler } from '../../modules/finance/generate-invoice-pdf/generate-invoice-pdf.handler';
import { ProcessPaymentHandler } from '../../modules/finance/process-payment/process-payment.handler';
import { ProcessPaymentDto } from '../../modules/finance/process-payment/process-payment.dto';
import { EnsureBookingInvoiceHandler } from '../../modules/finance/ensure-booking-invoice/ensure-booking-invoice.handler';
import { ApplyInvoiceDiscountHandler } from '../../modules/finance/apply-invoice-discount/apply-invoice-discount.handler';
import { ApplyInvoiceDiscountDto } from '../../modules/finance/apply-invoice-discount/apply-invoice-discount.dto';
import { CollectBookingPaymentHandler } from '../../modules/finance/collect-booking-payment/collect-booking-payment.handler';
import { CollectBookingPaymentDto } from '../../modules/finance/collect-booking-payment/collect-booking-payment.dto';
import { UserId } from '../../common/auth/user-id.decorator';
import { ListPaymentsHandler } from '../../modules/finance/list-payments/list-payments.handler';
import { GetPaymentHandler } from '../../modules/finance/get-payment/get-payment.handler';
import { ListPaymentsDto } from '../../modules/finance/list-payments/list-payments.dto';
import { ListInvoicesHandler } from '../../modules/finance/list-invoices/list-invoices.handler';
import { ListInvoicesDto } from '../../modules/finance/list-invoices/list-invoices.dto';
import { ApplyCouponHandler } from '../../modules/finance/apply-coupon/apply-coupon.handler';
import { ApplyCouponDto } from '../../modules/finance/apply-coupon/apply-coupon.dto';
import { ListCouponsHandler } from '../../modules/finance/coupons/list-coupons.handler';
import { ListCouponsDto } from '../../modules/finance/coupons/list-coupons.dto';
import { GetCouponHandler } from '../../modules/finance/coupons/get-coupon.handler';
import { CreateCouponHandler } from '../../modules/finance/coupons/create-coupon.handler';
import { CreateCouponDto } from '../../modules/finance/coupons/create-coupon.dto';
import { UpdateCouponHandler } from '../../modules/finance/coupons/update-coupon.handler';
import { UpdateCouponDto } from '../../modules/finance/coupons/update-coupon.dto';
import { DeleteCouponHandler } from '../../modules/finance/coupons/delete-coupon.handler';
import { GetPaymentStatsHandler } from '../../modules/finance/get-payment-stats/get-payment-stats.handler';
import { RefundPaymentHandler } from '../../modules/finance/refund-payment/refund-payment.handler';
import { ManualRefundPaymentHandler } from '../../modules/finance/refund-payment/manual-refund-payment.handler';
import { RefundPaymentDto, ManualRefundPaymentDto } from '../../modules/finance/refund-payment/refund-payment.dto';
import { VerifyPaymentHandler } from '../../modules/finance/verify-payment/verify-payment.handler';
import { VerifyPaymentDto } from '../../modules/finance/verify-payment/verify-payment.dto';
import {
  ALLOWED_BANK_TRANSFER_RECEIPT_MIME_TYPES,
  BankTransferUploadHandler,
  MAX_BANK_TRANSFER_RECEIPT_BYTES,
} from '../../modules/finance/bank-transfer-upload/bank-transfer-upload.handler';
import { BankTransferUploadDto } from '../../modules/finance/bank-transfer-upload/bank-transfer-upload.dto';
import { GetMoyasarConfigHandler } from '../../modules/finance/moyasar-config/get-moyasar-config.handler';
import { UpsertMoyasarConfigHandler } from '../../modules/finance/moyasar-config/upsert-moyasar-config.handler';
import { TestMoyasarConfigHandler } from '../../modules/finance/moyasar-config/test-moyasar-config.handler';
import { UpsertMoyasarConfigDto } from '../../modules/finance/moyasar-config/upsert-moyasar-config.dto';
import { CreatePackagePurchaseHandler } from '../../modules/finance/package-purchases/create-package-purchase/create-package-purchase.handler';
import { CreatePackagePurchaseDto } from '../../modules/finance/package-purchases/create-package-purchase/create-package-purchase.dto';
import { ListClientPackagePurchasesHandler } from '../../modules/finance/package-purchases/list-client-package-purchases/list-client-package-purchases.handler';
import { ListClientPackagePurchasesQueryDto } from '../../modules/finance/package-purchases/list-client-package-purchases/list-client-package-purchases.dto';
import { RefundPackagePurchaseHandler } from '../../modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler';
import { RefundPackagePurchaseDto } from '../../modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.dto';
import { MinioService } from '../../infrastructure/storage/minio.service';
import {
  FINANCE_INVOICES_BUCKET_NAME,
  extractInvoicePdfKey,
  resolveReceiptPdfKey,
} from '../../modules/finance/issue-invoice-receipt/invoice-pdf-key.helper';
import {
  EnsuredInvoiceDto,
  InvoiceDetailResponseDto,
  InvoiceListResponseDto,
  InvoicePdfUrlDto,
  InvoiceRecordDto,
} from './dto/finance-invoice-response.dto';
import {
  PaymentCollectionResponseDto,
  PaymentDetailResponseDto,
  PaymentListResponseDto,
  PaymentProcessResponseDto,
  PaymentStatsResponseDto,
} from './dto/finance-payment-response.dto';
import { PaymentRecordDto } from './dto/finance-payment-record-response.dto';
import {
  CouponListResponseDto,
  CouponRecordDto,
  CouponRedemptionRecordDto,
} from './dto/finance-coupon-response.dto';
import {
  MoyasarConfigTestResponseDto,
  MoyasarConfigUpsertResponseDto,
  MoyasarConfigViewDto,
} from './dto/finance-moyasar-response.dto';
import {
  PackagePurchaseListRowDto,
  PackagePurchaseRefundResponseDto,
  PackagePurchaseSaleResponseDto,
} from './dto/finance-package-purchase-response.dto';

// Short-lived presigned download window for dashboard PDF links (5 minutes).
const INVOICE_PDF_URL_EXPIRY_SECONDS = 300;

@ApiTags('Dashboard / Finance')
@ApiBearerAuth()
@ApiStandardResponses()
@ApiExtraModels(MoyasarConfigViewDto)
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/finance')
export class DashboardFinanceController {
  constructor(
    private readonly createInvoice: CreateInvoiceHandler,
    private readonly getInvoice: GetInvoiceHandler,
    private readonly generateInvoicePdf: GenerateInvoicePdfHandler,
    private readonly processPayment: ProcessPaymentHandler,
    private readonly ensureBookingInvoice: EnsureBookingInvoiceHandler,
    private readonly applyInvoiceDiscount: ApplyInvoiceDiscountHandler,
    private readonly collectBookingPayment: CollectBookingPaymentHandler,
    private readonly listPayments: ListPaymentsHandler,
    private readonly getPayment: GetPaymentHandler,
    private readonly listInvoices: ListInvoicesHandler,
    private readonly applyCoupon: ApplyCouponHandler,
    private readonly listCoupons: ListCouponsHandler,
    private readonly getCoupon: GetCouponHandler,
    private readonly createCoupon: CreateCouponHandler,
    private readonly updateCoupon: UpdateCouponHandler,
    private readonly deleteCoupon: DeleteCouponHandler,
    private readonly getPaymentStats: GetPaymentStatsHandler,
    private readonly refundPayment: RefundPaymentHandler,
    private readonly manualRefundPayment: ManualRefundPaymentHandler,
    private readonly verifyPayment: VerifyPaymentHandler,
    private readonly bankTransferUpload: BankTransferUploadHandler,
    private readonly getMoyasarConfig: GetMoyasarConfigHandler,
    private readonly upsertMoyasarConfig: UpsertMoyasarConfigHandler,
    private readonly testMoyasarConfig: TestMoyasarConfigHandler,
    private readonly createPackagePurchase: CreatePackagePurchaseHandler,
    private readonly listClientPackagePurchases: ListClientPackagePurchasesHandler,
    private readonly refundPackagePurchase: RefundPackagePurchaseHandler,
    private readonly storage: MinioService,
  ) {}

  // ── Invoices ──────────────────────────────────────────────────────────────

  @Get('invoices')
  @CheckPermissions({ action: 'read', subject: 'Invoice' })
  @ApiOperation({ summary: 'List invoices with optional filters' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1, schema: { type: 'integer', minimum: 1 } })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20, schema: { type: 'integer', minimum: 1, maximum: 200 } })
  @ApiOkResponse({ description: 'Paginated invoice list', type: InvoiceListResponseDto })
  listInvoicesEndpoint(@Query() query: ListInvoicesDto): Promise<InvoiceListResponseDto> {
    return this.listInvoices.execute({
      page: query.page,
      limit: query.limit,
      clientId: query.clientId,
      bookingId: query.bookingId,
      status: query.status,
      search: query.search,
      fromDate: startOfDayInTz(query.fromDate),
      toDate: endOfDayInTz(query.toDate),
    });
  }

  @Post('invoices')
  @CheckPermissions({ action: 'manage', subject: 'Invoice' })
  @ApiOperation({ summary: 'Create an invoice' })
  @ApiCreatedResponse({ description: 'Invoice created', type: InvoiceRecordDto })
  createInv(@Body() body: CreateInvoiceDto): Promise<InvoiceRecordDto> {
    return this.createInvoice.execute({
      ...body,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
    });
  }

  @Get('invoices/:id')
  @CheckPermissions({ action: 'read', subject: 'Invoice' })
  @ApiOperation({ summary: 'Get an invoice by id' })
  @ApiParam({ name: 'id', description: 'Invoice UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Invoice found', type: InvoiceDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Invoice not found', type: ApiErrorDto })
  getInv(@Param('id', ParseUUIDPipe) id: string): Promise<InvoiceDetailResponseDto> {
    return this.getInvoice.execute({ invoiceId: id });
  }

  @Get('invoices/:id/pdf')
  @CheckPermissions({ action: 'read', subject: 'Invoice' })
  @ApiOperation({
    summary: 'Get a URL to download the paid receipt PDF',
    description: 'Returns a short-lived URL for the paid receipt only. Responds 404 when no receipt has been issued for the invoice.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Short-lived URL of the paid receipt PDF', type: InvoicePdfUrlDto })
  @ApiResponse({ status: 404, description: 'Invoice not found, or no receipt has been issued for it', type: ApiErrorDto })
  async getInvoicePdf(@Param('id', ParseUUIDPipe) id: string): Promise<InvoicePdfUrlDto> {
    const invoice = await this.getInvoice.execute({ invoiceId: id });
    // Only an issued receipt is downloadable here (`receiptPdfKey`, or a legacy
    // `pdfUrl` that qualifies as a receipt). Mint a short-lived presigned URL,
    // never the raw key.
    const key = resolveReceiptPdfKey(invoice);
    if (!key) {
      throw new NotFoundException('No paid receipt has been issued for this invoice');
    }
    const url = await this.storage.getSignedUrl(
      FINANCE_INVOICES_BUCKET_NAME,
      key,
      INVOICE_PDF_URL_EXPIRY_SECONDS,
    );
    return { url };
  }

  @Post('invoices/:id/pdf')
  @CheckPermissions({ action: 'manage', subject: 'Invoice' })
  @ApiOperation({
    summary: 'Get the invoice PDF download URL, rendering a statement if no receipt exists',
    description: 'Returns the paid receipt when one has been issued; otherwise renders a fresh statement of the invoice. A statement is never stored on the invoice.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Short-lived URL of the paid receipt if issued, otherwise of a freshly rendered statement', type: InvoicePdfUrlDto })
  @ApiResponse({ status: 404, description: 'Invoice not found', type: ApiErrorDto })
  @HttpCode(HttpStatus.OK)
  async generateInvoicePdfEndpoint(@Param('id', ParseUUIDPipe) id: string): Promise<InvoicePdfUrlDto> {
    // Returns the frozen receipt key when one exists, otherwise renders a
    // statement (never stored on the invoice). We presign here, matching the GET.
    const storedKey = await this.generateInvoicePdf.execute({ invoiceId: id });
    const url = await this.storage.getSignedUrl(
      FINANCE_INVOICES_BUCKET_NAME,
      extractInvoicePdfKey(storedKey),
      INVOICE_PDF_URL_EXPIRY_SECONDS,
    );
    return { url };
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  @Get('payments/stats')
  @CheckPermissions({ action: 'read', subject: 'Payment' })
  @ApiOperation({ summary: 'Get payment statistics summary' })
  @ApiOkResponse({
    description: 'Operational payment statistics plus a separate read-only legacy summary',
    type: PaymentStatsResponseDto,
  })
  getPaymentStatsEndpoint(): Promise<PaymentStatsResponseDto> {
    return this.getPaymentStats.execute();
  }

  @Post('payments')
  @CheckPermissions({ action: 'manage', subject: 'Payment' })
  @ApiOperation({ summary: 'Process a payment for an invoice' })
  @ApiCreatedResponse({ description: 'Payment processed', type: PaymentProcessResponseDto })
  processPaymentEndpoint(@Body() body: ProcessPaymentDto): Promise<PaymentProcessResponseDto> {
    return this.processPayment.execute({ ...body });
  }

  @Post('bookings/:bookingId/invoice')
  // RECEPTIONIST opens RecordPaymentDialog on a payable booking, which calls
  // ensure-invoice to materialise the DRAFT invoice before collecting. The
  // built-in RECEPTIONIST role already has create:Invoice (and create:Payment),
  // so the gate must be create:Invoice — not manage:Invoice — for the dialog
  // open to succeed. ADMIN/OWNER still pass because CASL `manage` is a
  // superset of `create`.
  @CheckPermissions({ action: 'create', subject: 'Invoice' })
  @ApiOperation({ summary: 'Ensure a (DRAFT) invoice exists for a booking and return it' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiCreatedResponse({ description: 'Invoice ensured', type: EnsuredInvoiceDto })
  @ApiResponse({ status: 400, description: 'Booking is historical, has no payable amount, or has no client', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  ensureBookingInvoiceEndpoint(@Param('bookingId', ParseUUIDPipe) bookingId: string): Promise<EnsuredInvoiceDto> {
    return this.ensureBookingInvoice.execute({ bookingId });
  }

  // W1-T1 single-command reception collection: ensure invoice → optional
  // manual discount → record the manual payment. Manual/statistical methods
  // only — ONLINE_CARD still flows through the Moyasar webhook and COUPON is
  // a redemption flow (ApplyCouponHandler). The handler rejects both before
  // touching any composed handler.
  // W2-T1: tightened from manage:Payment-only to require BOTH payment AND
  // invoice permissions, because the handler composes EnsureBookingInvoiceHandler
  // and ApplyInvoiceDiscountHandler — capabilities the dedicated routes
  // `POST bookings/:bookingId/invoice` and `PATCH invoices/:id/discount` both
  // gate on invoice create/manage.
  // BK-COLLECT-P0: lowered from manage+manage to create+create so the
  // built-in RECEPTIONIST role (create:Payment, create:Invoice) can collect
  // a booking payment without 403. CaslGuard evaluates `required.every(...)`,
  // so listing both permissions enforces both. ADMIN / OWNER / ACCOUNTANT
  // still pass because CASL `manage` is a superset of every action and the
  // flatten-permissions step writes `subject:*` for `manage:subject` rules,
  // which `canDo` matches for create as well. We deliberately do NOT grant
  // RECEPTIONIST manage:Payment — that would also unlock PATCH payments/:id/verify
  // (bank-transfer approve/reject), which must stay admin/owner-only.
  @Post('bookings/:bookingId/collect')
  @CheckPermissions({ action: 'create', subject: 'Payment' }, { action: 'create', subject: 'Invoice' })
  @ApiOperation({
    summary: 'Collect a payment for a booking (reception manual/statistical)',
    description:
      'Single-command reception collection: ensures the booking\'s invoice exists, ' +
      'applies an optional manual discount, and records a manual payment. ' +
      'Omit amount to collect the full outstanding balance AFTER any discount. ' +
      'Returns payment:null when the discount fully covers the invoice (no payment row created). ' +
      'Manual/statistical methods only — ONLINE_CARD (must come through the Moyasar webhook) ' +
      'and COUPON (redeemed via ApplyCouponHandler) are rejected by the handler. ' +
      'Requires BOTH create:Payment AND create:Invoice (CASL `manage` is a ' +
      'superset of `create`, so ADMIN/OWNER/ACCOUNTANT still pass), enforced ' +
      'by CaslGuard via `required.every(...)`.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiCreatedResponse({ description: 'Invoice ensured, optional discount applied, manual payment recorded (or payment:null when 100% discounted)', type: PaymentCollectionResponseDto })
  @ApiResponse({ status: 400, description: 'Booking is historical, has no payable amount, has no client, method is ONLINE_CARD/COUPON, or invoice discount/payment tripwire', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  collectBookingPaymentEndpoint(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @UserId() userId: string,
    @Body() body: CollectBookingPaymentDto,
  ): Promise<PaymentCollectionResponseDto> {
    return this.collectBookingPayment.execute({
      bookingId,
      appliedBy: userId,
      ...body,
    });
  }

  @Patch('invoices/:id/discount')
  @CheckPermissions({ action: 'manage', subject: 'Invoice' })
  @ApiOperation({ summary: 'Apply or clear a manual discount on an unpaid invoice' })
  @ApiParam({ name: 'id', description: 'Invoice UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Discount applied; invoice totals recomputed', type: InvoiceRecordDto })
  @ApiResponse({ status: 400, description: 'Invoice not eligible or invalid discount', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'Invoice not found', type: ApiErrorDto })
  applyInvoiceDiscountEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @UserId() userId: string,
    @Body() body: ApplyInvoiceDiscountDto,
  ): Promise<InvoiceRecordDto> {
    return this.applyInvoiceDiscount.execute({ invoiceId: id, appliedBy: userId, ...body });
  }

  @Post('payments/bank-transfer')
  @CheckPermissions({ action: 'manage', subject: 'Payment' })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('receipt', {
    limits: { fileSize: MAX_BANK_TRANSFER_RECEIPT_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      if ((ALLOWED_BANK_TRANSFER_RECEIPT_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`Unsupported receipt file type: ${file.mimetype}`), false);
      }
    },
  }))
  @ApiOperation({ summary: 'Upload a bank transfer receipt for an invoice' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Receipt file + invoice metadata',
    schema: {
      type: 'object',
      required: ['receipt', 'invoiceId', 'amount'],
      properties: {
        receipt: { type: 'string', format: 'binary', description: 'Bank transfer receipt image or PDF' },
        invoiceId: { type: 'string', format: 'uuid', example: '00000000-0000-0000-0000-000000000000' },
        amount: {
          type: 'integer',
          minimum: 1,
          description: 'Transfer amount in integer halalas',
          example: 10000,
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Bank transfer receipt uploaded', type: PaymentRecordDto })
  bankTransferEndpoint(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: BankTransferUploadDto,
  ): Promise<PaymentRecordDto> {
    if (!file) throw new BadRequestException('receipt file is required');
    return this.bankTransferUpload.execute({
      ...body,
      fileBuffer: file.buffer,
      mimetype: file.mimetype,
      filename: file.originalname,
    });
  }

  @Get('payments')
  @CheckPermissions({ action: 'read', subject: 'Payment' })
  @ApiOperation({ summary: 'List payments with optional filters' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1, schema: { type: 'integer', minimum: 1 } })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20, schema: { type: 'integer', minimum: 1, maximum: 200 } })
  @ApiOkResponse({ description: 'Paginated payment list', type: PaymentListResponseDto })
  listPaymentsEndpoint(@Query() query: ListPaymentsDto): Promise<PaymentListResponseDto> {
    return this.listPayments.execute({
      page: query.page,
      limit: query.limit,
      invoiceId: query.invoiceId,
      clientId: query.clientId,
      method: query.method,
      status: query.status,
      search: query.search,
      fromDate: startOfDayInTz(query.fromDate),
      toDate: endOfDayInTz(query.toDate),
    });
  }

  @Get('payments/:id')
  @CheckPermissions({ action: 'read', subject: 'Payment' })
  @ApiOperation({ summary: 'Get a single payment by id' })
  @ApiParam({ name: 'id', description: 'Payment UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Payment found', type: PaymentDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Payment not found', type: ApiErrorDto })
  getPaymentEndpoint(@Param('id', ParseUUIDPipe) id: string): Promise<PaymentDetailResponseDto> {
    return this.getPayment.execute({ paymentId: id });
  }

  @Patch('payments/:id/refund')
  // Direct refund moves real money via Moyasar — OWNER/ADMIN only (manage:Setting),
  // excluding ACCOUNTANT. Mirrors dashboard/refunds approve/deny. Routine
  // payment work (record/verify) stays on manage:Payment below.
  @CheckPermissions({ action: 'manage', subject: 'Refund' })
  @ApiOperation({ summary: 'Refund a payment' })
  @ApiParam({ name: 'id', description: 'Payment UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Payment refunded', type: PaymentRecordDto })
  @ApiResponse({ status: 404, description: 'Payment not found', type: ApiErrorDto })
  refundPaymentEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RefundPaymentDto,
  ): Promise<PaymentRecordDto> {
    return this.refundPayment.execute({ paymentId: id, ...body });
  }

  @Patch('payments/:id/manual-refund')
  // Off-gateway (cash/bank-transfer) refund — no money moves through Moyasar,
  // reception hands the cash back. Gated on update:Payment so RECEPTION (and
  // admin/owner) can issue it; card/gateway refunds stay on manage:Setting above.
  @CheckPermissions({ action: 'update', subject: 'Payment' })
  @ApiOperation({ summary: 'Manually refund a cash/bank-transfer payment (off-gateway)' })
  @ApiParam({ name: 'id', description: 'Payment UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Payment refunded', type: PaymentRecordDto })
  @ApiResponse({ status: 400, description: 'Payment is a card payment or amount exceeds balance', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'Payment not found', type: ApiErrorDto })
  manualRefundPaymentEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @UserId() userId: string,
    @Body() body: ManualRefundPaymentDto,
  ): Promise<PaymentRecordDto> {
    return this.manualRefundPayment.execute({ paymentId: id, performedBy: userId, ...body });
  }

  @Patch('payments/:id/verify')
  @CheckPermissions({ action: 'manage', subject: 'Payment' })
  @ApiOperation({ summary: 'Approve or reject a pending bank transfer payment' })
  @ApiParam({ name: 'id', description: 'Payment UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Payment verification result', type: PaymentRecordDto })
  @ApiResponse({ status: 404, description: 'Payment not found', type: ApiErrorDto })
  verifyPaymentEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VerifyPaymentDto,
  ): Promise<PaymentRecordDto> {
    return this.verifyPayment.execute({ paymentId: id, ...body });
  }

  // ── Coupons apply (existing) ───────────────────────────────────────────────

  @Post('coupons/apply')
  @CheckPermissions({ action: 'manage', subject: 'Coupon' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a coupon code to an invoice' })
  @ApiOkResponse({ description: 'Coupon applied; returns updated discount amount', type: CouponRedemptionRecordDto })
  applyCouponEndpoint(@Body() body: ApplyCouponDto): Promise<CouponRedemptionRecordDto> {
    return this.applyCoupon.execute({ ...body });
  }

  // ── Coupons CRUD ──────────────────────────────────────────────────────────

  @Get('coupons')
  @CheckPermissions({ action: 'read', subject: 'Coupon' })
  @ApiOperation({ summary: 'List coupons' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1, schema: { type: 'integer', minimum: 1 } })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page (max 100)', example: 20, schema: { type: 'integer', minimum: 1, maximum: 100 } })
  @ApiOkResponse({ description: 'Paginated coupon list', type: CouponListResponseDto })
  listCouponsEndpoint(@Query() query: ListCouponsDto): Promise<CouponListResponseDto> {
    return this.listCoupons.execute({ ...query });
  }

  @Get('coupons/:id')
  @CheckPermissions({ action: 'read', subject: 'Coupon' })
  @ApiOperation({ summary: 'Get a coupon by id' })
  @ApiParam({ name: 'id', description: 'Coupon UUID or reference (e.g. CPN-1024)', example: 'CPN-1024' })
  @ApiOkResponse({ description: 'Coupon found', type: CouponRecordDto })
  @ApiResponse({ status: 404, description: 'Coupon not found', type: ApiErrorDto })
  getCouponEndpoint(@Param('id') id: string): Promise<CouponRecordDto> {
    return this.getCoupon.execute({ couponId: id });
  }

  @Post('coupons')
  @CheckPermissions({ action: 'manage', subject: 'Coupon' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a coupon' })
  @ApiCreatedResponse({ description: 'Coupon created', type: CouponRecordDto })
  createCouponEndpoint(@Body() body: CreateCouponDto): Promise<CouponRecordDto> {
    return this.createCoupon.execute({ ...body });
  }

  @Patch('coupons/:id')
  @CheckPermissions({ action: 'manage', subject: 'Coupon' })
  @ApiOperation({ summary: 'Update a coupon' })
  @ApiParam({ name: 'id', description: 'Coupon UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Coupon updated', type: CouponRecordDto })
  @ApiResponse({ status: 404, description: 'Coupon not found', type: ApiErrorDto })
  updateCouponEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCouponDto,
  ): Promise<CouponRecordDto> {
    return this.updateCoupon.execute({ couponId: id, ...body });
  }

  @Delete('coupons/:id')
  @CheckPermissions({ action: 'manage', subject: 'Coupon' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a coupon' })
  @ApiParam({ name: 'id', description: 'Coupon UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Coupon deleted' })
  @ApiResponse({ status: 404, description: 'Coupon not found', type: ApiErrorDto })
  async deleteCouponEndpoint(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.deleteCoupon.execute({ couponId: id });
  }

  // ── Moyasar Credentials ───────────────────────────────────────────────────

  @Get('moyasar/config')
  @CheckPermissions({ action: 'read', subject: 'ProviderConfig' })
  @ApiOperation({ summary: 'Get the Moyasar configuration (secret key masked)' })
  @ApiOkResponse({
    description: 'Moyasar configuration or null if unconfigured (secret key is masked; ciphertext is never returned)',
    schema: { allOf: [{ $ref: getSchemaPath(MoyasarConfigViewDto) }], nullable: true },
  })
  getMoyasarConfigEndpoint(): Promise<MoyasarConfigViewDto | null> {
    return this.getMoyasarConfig.execute();
  }

  @Patch('moyasar/config')
  @CheckPermissions({ action: 'manage', subject: 'ProviderConfig' })
  @ApiOperation({ summary: 'Create or update the Moyasar configuration' })
  @ApiOkResponse({ description: 'Moyasar configuration saved (secrets encrypted at rest; never echoed back)', type: MoyasarConfigUpsertResponseDto })
  upsertMoyasarConfigEndpoint(@Body() body: UpsertMoyasarConfigDto): Promise<MoyasarConfigUpsertResponseDto> {
    return this.upsertMoyasarConfig.execute(body);
  }

  @Post('moyasar/config/test')
  @CheckPermissions({ action: 'manage', subject: 'ProviderConfig' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Probe Moyasar with the stored credentials and persist verification status' })
  @ApiOkResponse({ description: 'Connectivity test result', type: MoyasarConfigTestResponseDto })
  testMoyasarConfigEndpoint(): Promise<MoyasarConfigTestResponseDto> {
    return this.testMoyasarConfig.execute();
  }

  // ── Package purchases (reception manual sale) ───────────────────────────────

  @Post('package-purchases')
  // RECEPTIONIST sells packages at the desk and is granted create:Invoice
  // (not manage). The dashboard gates the "sell" button on the same
  // create:Invoice, so the endpoint must match. manage:Invoice (ADMIN/OWNER)
  // still passes since CASL `manage` is a superset of every action.
  @CheckPermissions({ action: 'create', subject: 'Invoice' })
  @ApiOperation({ summary: 'Sell a SessionPackage to a client at the desk (manual payment)' })
  @ApiCreatedResponse({ description: 'Package purchase created, invoice issued, payment recorded, credits activated', type: PackagePurchaseSaleResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid package state, client missing, or ONLINE_CARD method', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'Package or client not found', type: ApiErrorDto })
  @ApiResponse({ status: 409, description: 'Idempotent replay found a corrupted or incomplete purchase', type: ApiErrorDto })
  createPackagePurchaseEndpoint(@Body() body: CreatePackagePurchaseDto): Promise<PackagePurchaseSaleResponseDto> {
    return this.createPackagePurchase.execute({ ...body });
  }

  @Post('package-purchases/:purchaseId/refund')
  // Manual refund moves money — same OWNER/ADMIN privilege as the gateway
  // refund approve/deny endpoints (manage:Setting), NOT routine manage:Invoice.
  @CheckPermissions({ action: 'manage', subject: 'Refund' })
  @ApiOperation({ summary: 'Manually refund a session-package purchase (marks REFUNDED, voids credits, records the refund)' })
  @ApiParam({ name: 'purchaseId', description: 'Package purchase UUID', example: '00000000-0000-4000-a000-000000000007' })
  @ApiOkResponse({ description: 'Purchase marked REFUNDED, credits voided, refund recorded', type: PackagePurchaseRefundResponseDto })
  @ApiResponse({ status: 400, description: 'Already refunded or refundAmount outside [0, amount charged (invoice total)]', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'Package purchase not found', type: ApiErrorDto })
  @HttpCode(HttpStatus.OK)
  refundPackagePurchaseEndpoint(
    @UserId() userId: string,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string,
    @Body() body: RefundPackagePurchaseDto,
  ): Promise<PackagePurchaseRefundResponseDto> {
    return this.refundPackagePurchase.execute({
      purchaseId,
      refundAmount: body.refundAmount,
      notes: body.notes,
      userId,
    });
  }

  // ── Client credits (read-only view) ─────────────────────────────────────────
  // Endpoint path follows the dashboard convention
  // /dashboard/clients/:clientId/<resource>; the client-scoped route lives in
  // the people controller for client CRUD, but the package-purchases view is
  // finance-owned so the route is registered here under /dashboard/finance
  // and the frontend calls it from the client's financial tab.
  @Get('clients/:clientId/package-purchases')
  @CheckPermissions({ action: 'read', subject: 'Invoice' })
  @ApiOperation({ summary: 'List a client\'s package purchases with their remaining credit balances' })
  @ApiParam({ name: 'clientId', description: 'Client UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Client package purchases with credits', type: [PackagePurchaseListRowDto] })
  listClientPackagePurchasesEndpoint(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query() query: ListClientPackagePurchasesQueryDto,
  ): Promise<PackagePurchaseListRowDto[]> {
    return this.listClientPackagePurchases.execute({
      clientId,
      status: query.status,
    });
  }
}
