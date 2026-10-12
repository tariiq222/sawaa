import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ClientRoute } from '../../common/auth/client-route.decorator';
import { CLIENT_PAGE_SCHEMA, toClientPage } from './client-page';
import { projectClientPayment } from './client-payment.projection';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ApiStandardResponses } from '../../common/swagger';
import { ClientThrottle } from '../../common/throttle/client-throttle';
import {
  ALLOWED_BANK_TRANSFER_RECEIPT_MIME_TYPES,
  BankTransferUploadHandler,
  MAX_BANK_TRANSFER_RECEIPT_BYTES,
} from '../../modules/finance/bank-transfer-upload/bank-transfer-upload.handler';
import { ClientBankTransferUploadDto } from '../../modules/finance/client-bank-transfer-upload.dto';
import { ClientListQueryDto } from '../../modules/finance/client-list-query.dto';
import { ListPaymentsHandler } from '../../modules/finance/list-payments/list-payments.handler';
import { GetNativePaymentConfigHandler } from '../../modules/finance/native-payments/get-native-payment-config/get-native-payment-config.handler';
import { InitNativePaymentHandler } from '../../modules/finance/native-payments/init-native-payment/init-native-payment.handler';
import { NativePaymentCapabilitiesDto, NativePaymentInitResponseDto, NativePaymentReconcileResponseDto } from '../../modules/finance/native-payments/native-payment.dto';
import { ReconcileNativePaymentHandler } from '../../modules/finance/native-payments/reconcile-native-payment/reconcile-native-payment.handler';
import { InitClientPaymentDto } from '../../modules/finance/payments/client/init-client-payment/init-client-payment.dto';
import { InitClientPaymentHandler } from '../../modules/finance/payments/client/init-client-payment/init-client-payment.handler';
import { GetClientBankTransferSettingsHandler } from '../../modules/org-experience/org-settings/get-client-bank-transfer-settings.handler';

// `GET client/payments/methods` is intentionally absent: the website wizard reads
// it anonymously, so it stays on the public `/public/payments/methods` route.
@ApiTags('Client / Payments')
@ApiStandardResponses()
@ClientRoute()
@Controller('client/payments')
export class ClientPaymentsController {
  constructor(
    private readonly listPayments: ListPaymentsHandler,
    private readonly initClientPayment: InitClientPaymentHandler,
    private readonly nativeConfig: GetNativePaymentConfigHandler,
    private readonly nativeInit: InitNativePaymentHandler,
    private readonly nativeReconcile: ReconcileNativePaymentHandler,
    private readonly bankTransferUpload: BankTransferUploadHandler,
    private readonly getClientBankTransferSettings: GetClientBankTransferSettingsHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated client\'s payments' })
  @ApiOkResponse({ description: 'Paginated payment list for the current client', schema: CLIENT_PAGE_SCHEMA })
  async list(@ClientSession() session: ClientSession, @Query() q: ClientListQueryDto) {
    const result = await this.listPayments.execute({
      clientId: session.id,
      page: q.page ?? 1,
      limit: q.pageSize ?? 20,
    });
    return toClientPage(result.items.map(projectClientPayment), result.meta.total, result.meta.page, result.meta.limit);
  }

  @ClientThrottle('payment')
  @Post('init')
  @ApiOperation({ summary: 'Initialize a Moyasar payment for a client invoice' })
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
  init(@ClientSession() session: ClientSession, @Body() body: InitClientPaymentDto) {
    return this.initClientPayment.execute({
      clientId: session.id,
      invoiceId: body.invoiceId,
      method: body.method,
      // Channel comes from the signed session, never from the URL.
      returnTo: session.channel === 'mobile' ? 'MOBILE' : undefined,
    });
  }

  @Get('native/config')
  @ApiOperation({ summary: 'Get native payment capabilities' })
  @ApiOkResponse({ type: NativePaymentCapabilitiesDto })
  nativeConfigEndpoint() {
    return this.nativeConfig.execute();
  }

  @ClientThrottle('payment')
  @Post('native/init')
  @ApiOperation({ summary: 'Reserve or resume a native invoice payment' })
  @ApiCreatedResponse({ type: NativePaymentInitResponseDto })
  nativeInitEndpoint(@ClientSession() session: ClientSession, @Body() body: InitClientPaymentDto) {
    return this.nativeInit.execute({ clientId: session.id, invoiceId: body.invoiceId, method: body.method });
  }

  @Post('native/:paymentId/reconcile')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Reconcile an owned native payment with Moyasar' })
  @ApiParam({ name: 'paymentId', description: 'Reserved native Payment UUID', format: 'uuid' })
  @ApiOkResponse({ type: NativePaymentReconcileResponseDto })
  nativeReconcileEndpoint(
    @ClientSession() session: ClientSession,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() body: unknown,
  ) {
    if (body != null && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length > 0)) {
      throw new BadRequestException('Reconciliation accepts no payment data');
    }
    return this.nativeReconcile.execute({ clientId: session.id, paymentId });
  }

  @ClientThrottle('money')
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
        amount: { type: 'integer', minimum: 1, description: 'Transfer amount in integer halalas', example: 10000 },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Receipt uploaded, payment recorded as PENDING_VERIFICATION' })
  uploadBankTransfer(
    @ClientSession() session: ClientSession,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ClientBankTransferUploadDto,
  ) {
    if (!file) throw new BadRequestException('receipt file is required');
    return this.bankTransferUpload.execute({
      invoiceId: body.invoiceId,
      amount: body.amount,
      fileBuffer: file.buffer,
      mimetype: file.mimetype,
      filename: file.originalname,
      clientId: session.id, // SECURITY: bind invoice to caller
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
  bankTransferSettings() {
    return this.getClientBankTransferSettings.execute();
  }
}
