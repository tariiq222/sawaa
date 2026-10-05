import { GetNativePaymentConfigHandler } from '../../../modules/finance/native-payments/get-native-payment-config/get-native-payment-config.handler';
import { InitNativePaymentHandler } from '../../../modules/finance/native-payments/init-native-payment/init-native-payment.handler';
import { ReconcileNativePaymentHandler } from '../../../modules/finance/native-payments/reconcile-native-payment/reconcile-native-payment.handler';
import { InitNativePackagePurchaseHandler } from '../../../modules/finance/package-purchases/init-package-purchase/init-native-package-purchase.handler';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { MobileClientPaymentsController } from './payments.controller';
import { PublicPaymentsController } from '../../public/payments.controller';
import { configureHttpContract } from '../../../common/bootstrap/configure-http-contract';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { shouldBypassCsrf } from '../../../common/middleware/csrf-policy';
import { csrfMiddleware } from '../../../common/middleware/csrf.middleware';
import { PrismaService } from '../../../infrastructure/database';
import { ClientJwtStrategy } from '../../../modules/identity/client-jwt.strategy';
import { ListPaymentsHandler } from '../../../modules/finance/list-payments/list-payments.handler';
import { GetInvoiceHandler } from '../../../modules/finance/get-invoice/get-invoice.handler';
import { BankTransferUploadHandler } from '../../../modules/finance/bank-transfer-upload/bank-transfer-upload.handler';
import { InitClientPaymentHandler } from '../../../modules/finance/payments/client/init-client-payment/init-client-payment.handler';
import { InitPackagePurchaseHandler } from '../../../modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler';
import { GetPublicPaymentMethodsHandler } from '../../../modules/finance/payments/public/get-public-payment-methods/get-public-payment-methods.handler';
import { GetClientBankTransferSettingsHandler } from '../../../modules/org-experience/org-settings/get-client-bank-transfer-settings.handler';

// Real routing, production validation, CSRF policy and client JWT authentication.
// Database reads and the purchase handler are isolated: this is HTTP contract
// coverage, not a payment-provider or financial acceptance test.
describe.each(['HOSTED','NATIVE'] as const)('Mobile package purchase init HTTP contract %s', (mode) => {
  let app: INestApplication;
  const clientId = '00000000-0000-4000-a000-000000000001';
  const secret = 'package-init-http-test-secret';
  const jwt = new JwtService({ secret });
  const token = jwt.sign({ sub: clientId, namespace: 'client', tokenVersion: 0 });
  const route = `/api/v1/mobile/client/payments/package-purchases/${mode==='NATIVE'?'native/':''}init`;
  const browserRoute = '/api/v1/public/payments/package-purchases/init';
  const input = {
    packageId: '00000000-0000-4000-a000-000000000002',
    packageFamilyId: '00000000-0000-4000-a000-000000000003',
    branchId: '00000000-0000-4000-a000-000000000004',
    idempotencyKey: '00000000-0000-4000-a000-000000000005',
  };
  const output = {
    purchaseId: '00000000-0000-4000-a000-000000000006',
    invoiceId: '00000000-0000-4000-a000-000000000007',
    paymentId: '00000000-0000-4000-a000-000000000008',
    ...(mode==='HOSTED'?{redirectUrl:'https://checkout.example.test/payment'}:{config:{givenId:'00000000-0000-4000-a000-000000000008',amount:230,currency:'SAR'}}),
  };
  const purchaseHandler = { execute: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MobileClientPaymentsController, PublicPaymentsController],
      providers: [
        ...[GetNativePaymentConfigHandler,InitNativePaymentHandler,ReconcileNativePaymentHandler].map(provide=>({provide,useValue:{execute:jest.fn().mockResolvedValue({})}})),
        ClientSessionGuard,
        ClientJwtStrategy,
        { provide: ConfigService, useValue: new ConfigService({ JWT_CLIENT_ACCESS_SECRET: secret }) },
        { provide: ClsService, useValue: { set: jest.fn() } },
        {
          provide: PrismaService,
          useValue: {
            client: {
              findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) =>
                where.id === clientId
                  ? { id: clientId, isActive: true, deletedAt: null, tokenVersion: 0, email: null, phone: null }
                  : null),
            },
          },
        },
        { provide: InitPackagePurchaseHandler, useValue: purchaseHandler },
        { provide: InitNativePackagePurchaseHandler, useValue: purchaseHandler },
        ...[
          ListPaymentsHandler,
          GetInvoiceHandler,
          BankTransferUploadHandler,
          InitClientPaymentHandler,
          GetPublicPaymentMethodsHandler,
          GetClientBankTransferSettingsHandler,
        ].map((provide) => ({ provide, useValue: { execute: jest.fn() } })),
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.use((req: Request, res: Response, next: NextFunction) =>
      shouldBypassCsrf(req.path) ? next() : csrfMiddleware(req, res, next));
    configureHttpContract(app, 'production');
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    purchaseHandler.execute.mockReset().mockResolvedValue(output);
  });

  it('allows native bearer checkout without a CSRF header and forwards the complete attempt', async () => {
    const response = await request(app.getHttpServer()).post(route)
      .set('Authorization', `Bearer ${token}`).send(input).expect(201);
    expect(response.body).toEqual(output);
    expect(purchaseHandler.execute).toHaveBeenCalledWith({ clientId, ...input });
  });

  it('allows a standalone offer without a family id', async () => {
    const { packageFamilyId: _familyId, ...standalone } = input;
    await request(app.getHttpServer()).post(route)
      .set('Authorization', `Bearer ${token}`).send(standalone).expect(201);
    expect(purchaseHandler.execute).toHaveBeenCalledWith({
      clientId, ...standalone, packageFamilyId: undefined,
    });
  });

  it('retains CSRF protection on the browser purchase route even with bearer credentials', async () => {
    const response = await request(app.getHttpServer()).post(browserRoute)
      .set('Authorization', `Bearer ${token}`).send(input).expect(403);
    expect(response.body.code).toBe('CSRF_INVALID');
    expect(purchaseHandler.execute).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated checkout before the purchase handler', async () => {
    await request(app.getHttpServer()).post(route).send(input).expect(401);
    expect(purchaseHandler.execute).not.toHaveBeenCalled();
  });

  it('rejects a token from the employee namespace', async () => {
    const employeeToken = jwt.sign({ sub: clientId, namespace: 'employee', tokenVersion: 0 });
    await request(app.getHttpServer()).post(route)
      .set('Authorization', `Bearer ${employeeToken}`).send(input).expect(401);
    expect(purchaseHandler.execute).not.toHaveBeenCalled();
  });

  it('rejects spoofed client identity rather than overriding the authenticated session', async () => {
    await request(app.getHttpServer()).post(route)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...input, clientId: '00000000-0000-4000-a000-000000000099' }).expect(400);
    expect(purchaseHandler.execute).not.toHaveBeenCalled();
  });

  it.each(['packageId', 'packageFamilyId', 'branchId', 'idempotencyKey'] as const)(
    'rejects malformed %s before the purchase handler', async (field) => {
      await request(app.getHttpServer()).post(route)
        .set('Authorization', `Bearer ${token}`).send({ ...input, [field]: 'invalid' }).expect(400);
      expect(purchaseHandler.execute).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing attempt key before the purchase handler', async () => {
    const { idempotencyKey: _attempt, ...withoutAttempt } = input;
    await request(app.getHttpServer()).post(route)
      .set('Authorization', `Bearer ${token}`).send(withoutAttempt).expect(400);
    expect(purchaseHandler.execute).not.toHaveBeenCalled();
  });
});
