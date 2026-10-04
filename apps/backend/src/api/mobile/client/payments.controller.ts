import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam,
  ApiOkResponse, ApiResponse, ApiProperty, ApiPropertyOptional,
  ApiConsumes, ApiBody, ApiCreatedResponse,
} from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { ClientSession } from '../../../common/auth/client-session.decorator';
import { ApiStandardResponses, ApiErrorDto } from '../../../common/swagger';
import { ListPaymentsHandler } from '../../../modules/finance/list-payments/list-payments.handler';
import { GetInvoiceHandler } from '../../../modules/finance/get-invoice/get-invoice.handler';
import {
  ALLOWED_BANK_TRANSFER_RECEIPT_MIME_TYPES,
  BankTransferUploadHandler,
  MAX_BANK_TRANSFER_RECEIPT_BYTES,
} from '../../../modules/finance/bank-transfer-upload/bank-transfer-upload.handler';
import { InitClientPaymentHandler } from '../../../modules/finance/payments/client/init-client-payment/init-client-payment.handler';
import { InitClientPaymentDto } from '../../../modules/finance/payments/client/init-client-payment/init-client-payment.dto';
import { InitPackagePurchaseHandler } from '../../../modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler';
import { InitPackagePurchaseDto } from '../../../modules/finance/package-purchases/init-package-purchase/init-package-purchase.dto';
import { Public } from '../../../common/guards/jwt.guard';
import { GetClientBankTransferSettingsHandler } from '../../../modules/org-experience/org-settings/get-client-bank-transfer-settings.handler';

export class MobileListPaymentsQuery {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Records per page', example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

export class MobileBankTransferUploadDto {
  @ApiProperty({ description: 'Invoice being paid', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() invoiceId!: string;

  @ApiProperty({ description: 'Transfer amount in integer halalas', example: 10000 })
  @IsInt() @Min(1) @Type(() => Number) amount!: number;
}

@ApiTags('Mobile Client / Payments')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Public()
@Controller('mobile/client/payments')
export class MobileClientPaymentsController {
  constructor(
    private readonly listPayments: ListPaymentsHandler,
    private readonly getInvoice: GetInvoiceHandler,
    private readonly bankTransferUpload: BankTransferUploadHandler,
    private readonly initClientPayment: InitClientPaymentHandler,
    private readonly getClientBankTransferSettings: GetClientBankTransferSettingsHandler,
    private readonly initPackagePurchase: InitPackagePurchaseHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated client\'s payments' })
  @ApiOkResponse({ description: 'Paginated payment list for the current client' })
  listMyPayments(
    @ClientSession() user: ClientSession,
    @Query() q: MobileListPaymentsQuery,
  ) {
    return this.listPayments.execute({
      clientId: user.id,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
  }

  @Get('bank-transfer/settings')
  @ApiOperation({ summary: 'Get client-visible bank transfer settings and accounts' })
  @ApiOkResponse({
    description: 'Bank transfer availability and configured recipient accounts',
    schema: {
      type: 'object',
      required: ['enabled', 'accounts'],
      properties: {
        enabled: { type: 'boolean' },
        accounts: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'label', 'bankName', 'beneficiaryName', 'iban'],
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              bankName: { type: 'string' },
              beneficiaryName: { type: 'string' },
              iban: { type: 'string' },
            },
          },
        },
      },
    },
  })
  getBankTransferSettings() {
    return this.getClientBankTransferSettings.execute();
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get an invoice by id (client-scoped)' })
  @ApiParam({ name: 'id', description: 'Invoice UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Invoice found' })
  @ApiResponse({ status: 404, description: 'Invoice not found', type: ApiErrorDto })
  getInvoiceEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @ClientSession() user: ClientSession,
  ) {
    return this.getInvoice.execute({ invoiceId: id, clientId: user.id });
  }

  @Post('init')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Initialize a Moyasar payment for an authenticated client invoice' })
  @ApiCreatedResponse({
    description: 'Payment initialized',
    schema: {
      type: 'object',
      required: ['paymentId', 'redirectUrl'],
      properties: {
        paymentId: { type: 'string', format: 'uuid' },
        redirectUrl: { type: 'string', example: 'https://checkout.moyasar.com/pay/payment-id' },
      },
    },
  })
  initPaymentEndpoint(
    @ClientSession() user: ClientSession,
    @Body() body: InitClientPaymentDto,
  ) {
    return this.initClientPayment.execute({
      clientId: user.id,
      invoiceId: body.invoiceId,
      method: body.method,
      returnTo: 'MOBILE',
    });
  }

  @Post('package-purchases/init')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Initialize a Moyasar payment to self-purchase a session package' })
  @ApiCreatedResponse({
    description: 'Package purchase initialized (PENDING until the Moyasar payment completes)',
    schema: {
      type: 'object',
      required: ['purchaseId', 'invoiceId', 'paymentId', 'redirectUrl'],
      properties: {
        purchaseId: { type: 'string', format: 'uuid' },
        invoiceId: { type: 'string', format: 'uuid' },
        paymentId: { type: 'string', format: 'uuid' },
        redirectUrl: { type: 'string', example: 'https://checkout.moyasar.com/pay/payment-id' },
      },
    },
  })
  initPackagePurchaseEndpoint(
    @ClientSession() user: ClientSession,
    @Body() body: InitPackagePurchaseDto,
  ) {
    return this.initPackagePurchase.execute({
      clientId: user.id,
      idempotencyKey: body.idempotencyKey,
      packageId: body.packageId,
      packageFamilyId: body.packageFamilyId,
      branchId: body.branchId,
    });
  }

  @Post('bank-transfer')
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
  @ApiOperation({ summary: 'Upload a bank-transfer receipt for an invoice (client)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Receipt file + invoice metadata',
    schema: {
      type: 'object',
      required: ['receipt', 'invoiceId', 'amount'],
      properties: {
        receipt: { type: 'string', format: 'binary', description: 'Receipt image or PDF' },
        invoiceId: { type: 'string', format: 'uuid' },
        amount: {
          type: 'integer',
          minimum: 1,
          description: 'Transfer amount in integer halalas',
          example: 10000,
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Receipt uploaded, payment recorded as PENDING_VERIFICATION' })
  uploadBankTransferEndpoint(
    @ClientSession() user: ClientSession,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: MobileBankTransferUploadDto,
  ) {
    if (!file) throw new BadRequestException('receipt file is required');
    return this.bankTransferUpload.execute({
      invoiceId: body.invoiceId,
      amount: body.amount,
      fileBuffer: file.buffer,
      mimetype: file.mimetype,
      filename: file.originalname,
      clientId: user.id, // SECURITY (P0-5): bind invoice to caller
    });
  }
}
