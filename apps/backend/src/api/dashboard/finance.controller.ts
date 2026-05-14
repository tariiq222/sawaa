import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam,
  ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse, ApiResponse,
  ApiConsumes, ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ApiStandardResponses, ApiErrorDto } from '../../common/swagger';
import { CreateInvoiceHandler } from '../../modules/finance/create-invoice/create-invoice.handler';
import { CreateInvoiceDto } from '../../modules/finance/create-invoice/create-invoice.dto';
import { GetInvoiceHandler } from '../../modules/finance/get-invoice/get-invoice.handler';
import { ProcessPaymentHandler } from '../../modules/finance/process-payment/process-payment.handler';
import { ProcessPaymentDto } from '../../modules/finance/process-payment/process-payment.dto';
import { ListPaymentsHandler } from '../../modules/finance/list-payments/list-payments.handler';
import { ListPaymentsDto } from '../../modules/finance/list-payments/list-payments.dto';
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
import { RefundPaymentDto } from '../../modules/finance/refund-payment/refund-payment.dto';
import { VerifyPaymentHandler } from '../../modules/finance/verify-payment/verify-payment.handler';
import { VerifyPaymentDto } from '../../modules/finance/verify-payment/verify-payment.dto';
import { BankTransferUploadHandler } from '../../modules/finance/bank-transfer-upload/bank-transfer-upload.handler';
import { BankTransferUploadDto } from '../../modules/finance/bank-transfer-upload/bank-transfer-upload.dto';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { GetMoyasarConfigHandler } from '../../modules/finance/moyasar-config/get-moyasar-config.handler';
import { UpsertMoyasarConfigHandler } from '../../modules/finance/moyasar-config/upsert-moyasar-config.handler';
import { TestMoyasarConfigHandler } from '../../modules/finance/moyasar-config/test-moyasar-config.handler';
import { UpsertMoyasarConfigDto } from '../../modules/finance/moyasar-config/upsert-moyasar-config.dto';

@ApiTags('Dashboard / Finance')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/finance')
export class DashboardFinanceController {
  constructor(
    private readonly createInvoice: CreateInvoiceHandler,
    private readonly getInvoice: GetInvoiceHandler,
    private readonly processPayment: ProcessPaymentHandler,
    private readonly listPayments: ListPaymentsHandler,
    private readonly applyCoupon: ApplyCouponHandler,
    private readonly listCoupons: ListCouponsHandler,
    private readonly getCoupon: GetCouponHandler,
    private readonly createCoupon: CreateCouponHandler,
    private readonly updateCoupon: UpdateCouponHandler,
    private readonly deleteCoupon: DeleteCouponHandler,
    private readonly getPaymentStats: GetPaymentStatsHandler,
    private readonly refundPayment: RefundPaymentHandler,
    private readonly verifyPayment: VerifyPaymentHandler,
    private readonly bankTransferUpload: BankTransferUploadHandler,
    private readonly getMoyasarConfig: GetMoyasarConfigHandler,
    private readonly upsertMoyasarConfig: UpsertMoyasarConfigHandler,
    private readonly testMoyasarConfig: TestMoyasarConfigHandler,
  ) {}

  // ── Invoices ──────────────────────────────────────────────────────────────

  @Post('invoices')
  @CheckPermissions({ action: 'manage', subject: 'Invoice' })
  @ApiOperation({ summary: 'Create an invoice' })
  @ApiCreatedResponse({ description: 'Invoice created' })
  createInv(@Body() body: CreateInvoiceDto) {
    return this.createInvoice.execute({
      ...body,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
    });
  }

  @Get('invoices/:id')
  @CheckPermissions({ action: 'read', subject: 'Invoice' })
  @ApiOperation({ summary: 'Get an invoice by id' })
  @ApiParam({ name: 'id', description: 'Invoice UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Invoice found' })
  @ApiResponse({ status: 404, description: 'Invoice not found', type: ApiErrorDto })
  getInv(@Param('id', ParseUUIDPipe) id: string) {
    return this.getInvoice.execute({ invoiceId: id });
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  @Get('payments/stats')
  @CheckPermissions({ action: 'read', subject: 'Payment' })
  @ApiOperation({ summary: 'Get payment statistics summary' })
  @ApiOkResponse({ description: 'Payment statistics' })
  getPaymentStatsEndpoint() {
    return this.getPaymentStats.execute();
  }

  @Post('payments')
  @CheckPermissions({ action: 'manage', subject: 'Payment' })
  @ApiOperation({ summary: 'Process a payment for an invoice' })
  @ApiCreatedResponse({ description: 'Payment processed' })
  processPaymentEndpoint(@Body() body: ProcessPaymentDto) {
    return this.processPayment.execute({ ...body });
  }

  @Post('payments/bank-transfer')
  @CheckPermissions({ action: 'manage', subject: 'Payment' })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('receipt'))
  @ApiOperation({ summary: 'Upload a bank transfer receipt for an invoice' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Receipt file + invoice metadata',
    schema: {
      type: 'object',
      required: ['receipt', 'invoiceId', 'clientId', 'amount'],
      properties: {
        receipt: { type: 'string', format: 'binary', description: 'Bank transfer receipt image or PDF' },
        invoiceId: { type: 'string', format: 'uuid', example: '00000000-0000-0000-0000-000000000000' },
        clientId: { type: 'string', format: 'uuid', example: '00000000-0000-0000-0000-000000000000' },
        amount: { type: 'number', example: 100.00 },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Bank transfer receipt uploaded' })
  bankTransferEndpoint(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: BankTransferUploadDto,
  ) {
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
  @ApiOkResponse({ description: 'Paginated payment list' })
  listPaymentsEndpoint(@Query() query: ListPaymentsDto) {
    return this.listPayments.execute({
      page: query.page,
      limit: query.limit,
      invoiceId: query.invoiceId,
      clientId: query.clientId,
      method: query.method,
      status: query.status,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
    });
  }

  @Patch('payments/:id/refund')
  @CheckPermissions({ action: 'manage', subject: 'Payment' })
  @ApiOperation({ summary: 'Refund a payment' })
  @ApiParam({ name: 'id', description: 'Payment UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Payment refunded' })
  @ApiResponse({ status: 404, description: 'Payment not found', type: ApiErrorDto })
  refundPaymentEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RefundPaymentDto,
  ) {
    return this.refundPayment.execute({ paymentId: id, ...body });
  }

  @Patch('payments/:id/verify')
  @CheckPermissions({ action: 'manage', subject: 'Payment' })
  @ApiOperation({ summary: 'Approve or reject a pending bank transfer payment' })
  @ApiParam({ name: 'id', description: 'Payment UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Payment verification result' })
  @ApiResponse({ status: 404, description: 'Payment not found', type: ApiErrorDto })
  verifyPaymentEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VerifyPaymentDto,
  ) {
    return this.verifyPayment.execute({ paymentId: id, ...body });
  }

  // ── Coupons apply (existing) ───────────────────────────────────────────────

  @Post('coupons/apply')
  @CheckPermissions({ action: 'manage', subject: 'Coupon' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a coupon code to an invoice' })
  @ApiOkResponse({ description: 'Coupon applied; returns updated discount amount' })
  applyCouponEndpoint(@Body() body: ApplyCouponDto) {
    return this.applyCoupon.execute({ ...body });
  }

  // ── Coupons CRUD ──────────────────────────────────────────────────────────

  @Get('coupons')
  @CheckPermissions({ action: 'read', subject: 'Coupon' })
  @ApiOperation({ summary: 'List coupons' })
  @ApiOkResponse({ description: 'Paginated coupon list' })
  listCouponsEndpoint(@Query() query: ListCouponsDto) {
    return this.listCoupons.execute({ ...query });
  }

  @Get('coupons/:id')
  @CheckPermissions({ action: 'read', subject: 'Coupon' })
  @ApiOperation({ summary: 'Get a coupon by id' })
  @ApiParam({ name: 'id', description: 'Coupon UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Coupon found' })
  @ApiResponse({ status: 404, description: 'Coupon not found', type: ApiErrorDto })
  getCouponEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.getCoupon.execute({ couponId: id });
  }

  @Post('coupons')
  @CheckPermissions({ action: 'manage', subject: 'Coupon' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a coupon' })
  @ApiCreatedResponse({ description: 'Coupon created' })
  createCouponEndpoint(@Body() body: CreateCouponDto) {
    return this.createCoupon.execute({ ...body });
  }

  @Patch('coupons/:id')
  @CheckPermissions({ action: 'manage', subject: 'Coupon' })
  @ApiOperation({ summary: 'Update a coupon' })
  @ApiParam({ name: 'id', description: 'Coupon UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Coupon updated' })
  @ApiResponse({ status: 404, description: 'Coupon not found', type: ApiErrorDto })
  updateCouponEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCouponDto,
  ) {
    return this.updateCoupon.execute({ couponId: id, ...body });
  }

  @Delete('coupons/:id')
  @CheckPermissions({ action: 'manage', subject: 'Coupon' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a coupon' })
  @ApiParam({ name: 'id', description: 'Coupon UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Coupon deleted' })
  @ApiResponse({ status: 404, description: 'Coupon not found', type: ApiErrorDto })
  deleteCouponEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteCoupon.execute({ couponId: id });
  }

  // ── Per-tenant Moyasar credentials ────────────────────────────────────────

  @Get('moyasar/config')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'Get the per-tenant Moyasar configuration (secret key masked)' })
  @ApiOkResponse({ description: 'Moyasar configuration or null if unconfigured' })
  getMoyasarConfigEndpoint() {
    return this.getMoyasarConfig.execute();
  }

  @Patch('moyasar/config')
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @ApiOperation({ summary: 'Create or update the per-tenant Moyasar configuration' })
  @ApiOkResponse({ description: 'Moyasar configuration saved (secrets encrypted at rest)' })
  upsertMoyasarConfigEndpoint(@Body() body: UpsertMoyasarConfigDto) {
    return this.upsertMoyasarConfig.execute(body);
  }

  @Post('moyasar/config/test')
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Probe Moyasar with the stored credentials and persist verification status' })
  @ApiOkResponse({ description: 'Connectivity test result' })
  testMoyasarConfigEndpoint() {
    return this.testMoyasarConfig.execute();
  }
}
