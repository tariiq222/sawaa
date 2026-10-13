import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClientRoute } from '../../common/auth/client-route.decorator';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ApiStandardResponses } from '../../common/swagger';
import { ClientThrottle } from '../../common/throttle/client-throttle';
import { NativePackagePurchaseInitResponseDto } from '../../modules/finance/native-payments/native-payment.dto';
import { InitNativePackagePurchaseHandler } from '../../modules/finance/package-purchases/init-package-purchase/init-native-package-purchase.handler';
import { InitPackagePurchaseDto } from '../../modules/finance/package-purchases/init-package-purchase/init-package-purchase.dto';
import { InitPackagePurchaseHandler } from '../../modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler';

@ApiTags('Client / Package purchases')
@ApiStandardResponses()
@ClientRoute()
@Controller('client/package-purchases')
export class ClientPackagePurchasesController {
  constructor(
    private readonly initPackagePurchase: InitPackagePurchaseHandler,
    private readonly nativePackageInit: InitNativePackagePurchaseHandler,
  ) {}

  @ClientThrottle('money')
  @Post('init')
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
  init(@ClientSession() session: ClientSession, @Body() body: InitPackagePurchaseDto) {
    // The purchase is bound to the session client, never a caller-supplied id.
    return this.initPackagePurchase.execute({
      clientId: session.id,
      idempotencyKey: body.idempotencyKey,
      packageId: body.packageId,
      packageFamilyId: body.packageFamilyId,
      branchId: body.branchId,
    });
  }

  @ClientThrottle('money')
  @Post('native/init')
  @ApiOperation({ summary: 'Reserve or resume a native package purchase payment' })
  @ApiCreatedResponse({ type: NativePackagePurchaseInitResponseDto })
  initNative(@ClientSession() session: ClientSession, @Body() body: InitPackagePurchaseDto) {
    return this.nativePackageInit.execute({
      clientId: session.id,
      idempotencyKey: body.idempotencyKey,
      packageId: body.packageId,
      packageFamilyId: body.packageFamilyId,
      branchId: body.branchId,
    });
  }
}
