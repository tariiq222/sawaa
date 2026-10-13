import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ClientPaymentsController } from './payments.controller';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { BankTransferUploadHandler } from '../../modules/finance/bank-transfer-upload/bank-transfer-upload.handler';
import { ListPaymentsHandler } from '../../modules/finance/list-payments/list-payments.handler';
import { GetNativePaymentConfigHandler } from '../../modules/finance/native-payments/get-native-payment-config/get-native-payment-config.handler';
import { InitNativePaymentHandler } from '../../modules/finance/native-payments/init-native-payment/init-native-payment.handler';
import { ReconcileNativePaymentHandler } from '../../modules/finance/native-payments/reconcile-native-payment/reconcile-native-payment.handler';
import { InitClientPaymentHandler } from '../../modules/finance/payments/client/init-client-payment/init-client-payment.handler';
import { GetClientBankTransferSettingsHandler } from '../../modules/org-experience/org-settings/get-client-bank-transfer-settings.handler';

const INVOICE_ID = '11111111-1111-4111-8111-111111111111';
const PAYMENT_ID = '22222222-2222-4222-8222-222222222222';

describe('ClientPaymentsController', () => {
  let app: INestApplication;
  let channel: 'web' | 'mobile' = 'web';
  const listPayments = { execute: jest.fn() };
  const initPayment = { execute: jest.fn() };
  const nativeConfig = { execute: jest.fn() };
  const nativeInit = { execute: jest.fn() };
  const nativeReconcile = { execute: jest.fn() };
  const bankTransfer = { execute: jest.fn() };
  const bankSettings = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClientPaymentsController],
      providers: [
        { provide: ListPaymentsHandler, useValue: listPayments },
        { provide: InitClientPaymentHandler, useValue: initPayment },
        { provide: GetNativePaymentConfigHandler, useValue: nativeConfig },
        { provide: InitNativePaymentHandler, useValue: nativeInit },
        { provide: ReconcileNativePaymentHandler, useValue: nativeReconcile },
        { provide: BankTransferUploadHandler, useValue: bankTransfer },
        { provide: GetClientBankTransferSettingsHandler, useValue: bankSettings },
      ],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = { id: 'client-1', email: null, phone: null, channel };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { await app.close(); });
  afterEach(() => { jest.resetAllMocks(); channel = 'web'; });

  it('GET / maps pageSize to limit and returns only allow-listed fields', async () => {
    listPayments.execute.mockResolvedValue({
      meta: { total: 1, page: 2, limit: 5, totalPages: 1 },
      items: [{
        id: 'p1', number: 'PAY-1', invoiceId: 'i1', amount: 100, currency: 'SAR', method: 'CARD', status: 'COMPLETED',
        createdAt: 'c', processedAt: null, collectionDate: null, gatewayRef: 'secret', clientName: 'PII',
        invoice: { bookingId: 'b1', total: 100, clientId: 'x' },
      }],
    });
    const res = await request(app.getHttpServer()).get('/client/payments?page=2&pageSize=5').expect(200);
    expect(listPayments.execute).toHaveBeenCalledWith({ clientId: 'client-1', page: 2, limit: 5 });
    expect(res.body).toMatchObject({ total: 1, page: 2, pageSize: 5 });
    expect(res.body).not.toHaveProperty('meta');
    expect(res.body).not.toHaveProperty('limit');
    expect(res.body.items[0]).toEqual({
      id: 'p1', number: 'PAY-1', invoiceId: 'i1', amount: 100, currency: 'SAR', method: 'CARD', status: 'COMPLETED',
      createdAt: 'c', processedAt: null, collectionDate: null, invoice: { bookingId: 'b1', total: 100 },
    });
  });

  it('POST /init sends no returnTo for the web channel', async () => {
    initPayment.execute.mockResolvedValue({ paymentId: 'p', redirectUrl: 'u' });
    await request(app.getHttpServer()).post('/client/payments/init').send({ invoiceId: INVOICE_ID }).expect(201);
    expect(initPayment.execute).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'client-1', invoiceId: INVOICE_ID, returnTo: undefined }));
  });

  it('POST /init sends returnTo MOBILE for the mobile channel', async () => {
    channel = 'mobile';
    initPayment.execute.mockResolvedValue({ paymentId: 'p', redirectUrl: 'u' });
    await request(app.getHttpServer()).post('/client/payments/init').send({ invoiceId: INVOICE_ID }).expect(201);
    expect(initPayment.execute).toHaveBeenCalledWith(expect.objectContaining({ returnTo: 'MOBILE' }));
  });

  it('GET /native/config delegates to the handler', async () => {
    nativeConfig.execute.mockResolvedValue({ ok: true });
    await request(app.getHttpServer()).get('/client/payments/native/config').expect(200);
    expect(nativeConfig.execute).toHaveBeenCalled();
  });

  it('POST /native/init forwards the session client', async () => {
    nativeInit.execute.mockResolvedValue({});
    await request(app.getHttpServer()).post('/client/payments/native/init').send({ invoiceId: INVOICE_ID }).expect(201);
    expect(nativeInit.execute).toHaveBeenCalledWith({ clientId: 'client-1', invoiceId: INVOICE_ID, method: undefined });
  });

  it('POST /native/:id/reconcile accepts an empty body', async () => {
    nativeReconcile.execute.mockResolvedValue({});
    await request(app.getHttpServer()).post(`/client/payments/native/${PAYMENT_ID}/reconcile`).expect(200);
    expect(nativeReconcile.execute).toHaveBeenCalledWith({ clientId: 'client-1', paymentId: PAYMENT_ID });
  });

  it('POST /native/:id/reconcile rejects a non-empty body', async () => {
    await request(app.getHttpServer()).post(`/client/payments/native/${PAYMENT_ID}/reconcile`).send({ status: 'paid' }).expect(400);
    expect(nativeReconcile.execute).not.toHaveBeenCalled();
  });

  it('POST /bank-transfer requires a receipt file', async () => {
    await request(app.getHttpServer())
      .post('/client/payments/bank-transfer')
      .field('invoiceId', INVOICE_ID).field('amount', '1000')
      .expect(400);
    expect(bankTransfer.execute).not.toHaveBeenCalled();
  });

  it('POST /bank-transfer forwards the file and binds the client', async () => {
    bankTransfer.execute.mockResolvedValue({ id: 'p' });
    await request(app.getHttpServer())
      .post('/client/payments/bank-transfer')
      .field('invoiceId', INVOICE_ID).field('amount', '1000')
      .attach('receipt', Buffer.from('x'), { filename: 'r.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(bankTransfer.execute).toHaveBeenCalledWith(expect.objectContaining({
      invoiceId: INVOICE_ID, amount: 1000, clientId: 'client-1', mimetype: 'application/pdf', filename: 'r.pdf',
    }));
  });

  it('POST /bank-transfer rejects an unsupported mime type', async () => {
    await request(app.getHttpServer())
      .post('/client/payments/bank-transfer')
      .field('invoiceId', INVOICE_ID).field('amount', '1000')
      .attach('receipt', Buffer.from('x'), { filename: 'r.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('GET /bank-transfer/settings delegates to the handler', async () => {
    bankSettings.execute.mockResolvedValue({ enabled: false, accounts: [] });
    const res = await request(app.getHttpServer()).get('/client/payments/bank-transfer/settings').expect(200);
    expect(res.body).toEqual({ enabled: false, accounts: [] });
  });
});
