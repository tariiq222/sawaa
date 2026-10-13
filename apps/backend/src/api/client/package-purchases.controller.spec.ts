import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ClientPackagePurchasesController } from './package-purchases.controller';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { InitNativePackagePurchaseHandler } from '../../modules/finance/package-purchases/init-package-purchase/init-native-package-purchase.handler';
import { InitPackagePurchaseHandler } from '../../modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler';

const PKG = '11111111-1111-4111-8111-111111111111';
const KEY = '33333333-3333-4333-8333-333333333333';

describe('ClientPackagePurchasesController', () => {
  let app: INestApplication;
  const init = { execute: jest.fn() };
  const nativeInit = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClientPackagePurchasesController],
      providers: [
        { provide: InitPackagePurchaseHandler, useValue: init },
        { provide: InitNativePackagePurchaseHandler, useValue: nativeInit },
      ],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = { id: 'client-1', email: null, phone: null, channel: 'web' };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { await app.close(); });
  afterEach(() => jest.resetAllMocks());

  it('POST /init forwards args bound to the session client', async () => {
    init.execute.mockResolvedValue({});
    await request(app.getHttpServer()).post('/client/package-purchases/init').send({ idempotencyKey: KEY, packageId: PKG, branchId: PKG }).expect(201);
    expect(init.execute).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'client-1', idempotencyKey: KEY, packageId: PKG }));
  });

  it('POST /native/init uses the native handler', async () => {
    nativeInit.execute.mockResolvedValue({});
    await request(app.getHttpServer()).post('/client/package-purchases/native/init').send({ idempotencyKey: KEY, packageId: PKG, branchId: PKG }).expect(201);
    expect(nativeInit.execute).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'client-1', packageId: PKG }));
    expect(init.execute).not.toHaveBeenCalled();
  });
});
