import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MobileClientPaymentsController } from './payments.controller';
import { ListPaymentsHandler } from '../../../modules/finance/list-payments/list-payments.handler';
import { GetInvoiceHandler } from '../../../modules/finance/get-invoice/get-invoice.handler';
import { BankTransferUploadHandler } from '../../../modules/finance/bank-transfer-upload/bank-transfer-upload.handler';
import { InitClientPaymentHandler } from '../../../modules/finance/payments/client/init-client-payment/init-client-payment.handler';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';

describe('MobileClientPaymentsController (e2e)', () => {
  let app: INestApplication;

  const mockListPayments = { execute: jest.fn() };
  const mockGetInvoice = { execute: jest.fn() };
  const mockBankTransfer = { execute: jest.fn() };
  const mockInitPayment = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileClientPaymentsController],
      providers: [
        { provide: ListPaymentsHandler, useValue: mockListPayments },
        { provide: GetInvoiceHandler, useValue: mockGetInvoice },
        { provide: BankTransferUploadHandler, useValue: mockBankTransfer },
        { provide: InitClientPaymentHandler, useValue: mockInitPayment },
      ],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: 'client-1', organizationId: 'org-1' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const invoiceId = '00000000-0000-4000-a000-000000000001';

  describe('GET /mobile/client/payments', () => {
    it('returns 200 with paginated payments', async () => {
      mockListPayments.execute.mockResolvedValue({ data: [{ id: 'p-1' }], total: 1, page: 1, limit: 20 });

      const res = await request(app.getHttpServer())
        .get('/mobile/client/payments')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(mockListPayments.execute).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'client-1', page: 1, limit: 20 }),
      );
    });

    it('passes page and limit query params', async () => {
      mockListPayments.execute.mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 });

      await request(app.getHttpServer())
        .get('/mobile/client/payments?page=2&limit=10')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListPayments.execute).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'client-1', page: 2, limit: 10 }),
      );
    });
  });

  describe('GET /mobile/client/payments/invoices/:id', () => {
    it('returns 200 with invoice details', async () => {
      mockGetInvoice.execute.mockResolvedValue({ id: invoiceId, total: 150 });

      const res = await request(app.getHttpServer())
        .get(`/mobile/client/payments/invoices/${invoiceId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.total).toBe(150);
      expect(mockGetInvoice.execute).toHaveBeenCalledWith({ invoiceId, clientId: 'client-1' });
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/mobile/client/payments/invoices/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('POST /mobile/client/payments/init', () => {
    it('returns 201 on valid init', async () => {
      mockInitPayment.execute.mockResolvedValue({
        paymentId: 'pay-1',
        redirectUrl: 'https://checkout.moyasar.com/pay/pay-1',
      });

      const res = await request(app.getHttpServer())
        .post('/mobile/client/payments/init')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ invoiceId, method: 'ONLINE_CARD' })
        .expect(201);

      expect(res.body.paymentId).toBe('pay-1');
      expect(mockInitPayment.execute).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'client-1', invoiceId, method: 'ONLINE_CARD' }),
      );
    });

    it('returns 400 for missing invoiceId', async () => {
      return request(app.getHttpServer())
        .post('/mobile/client/payments/init')
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(400);
    });

    it('returns 400 for invalid method', async () => {
      return request(app.getHttpServer())
        .post('/mobile/client/payments/init')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ invoiceId, method: 'CASH' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/mobile/client/payments/init')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ invoiceId, extra: 'bad' })
        .expect(400);
    });
  });

  describe('POST /mobile/client/payments/bank-transfer', () => {
    it('returns 201 on valid upload', async () => {
      mockBankTransfer.execute.mockResolvedValue({ id: 'bt-1', status: 'PENDING_VERIFICATION' });

      const res = await request(app.getHttpServer())
        .post('/mobile/client/payments/bank-transfer')
        .set('Authorization', 'Bearer fake-jwt')
        .attach('receipt', Buffer.from('receipt image'), 'receipt.png')
        .field('invoiceId', invoiceId)
        .field('amount', '250')
        .expect(201);

      expect(res.body.status).toBe('PENDING_VERIFICATION');
    });

    it('returns 400 when no receipt is uploaded', async () => {
      const res = await request(app.getHttpServer())
        .post('/mobile/client/payments/bank-transfer')
        .set('Authorization', 'Bearer fake-jwt')
        .field('invoiceId', invoiceId)
        .field('amount', '250')
        .expect(400);

      expect(res.body.message).toBe('receipt file is required');
    });

    it('returns 400 for invalid invoiceId', async () => {
      return request(app.getHttpServer())
        .post('/mobile/client/payments/bank-transfer')
        .set('Authorization', 'Bearer fake-jwt')
        .attach('receipt', Buffer.from('receipt'), 'receipt.png')
        .field('invoiceId', 'not-a-uuid')
        .field('amount', '250')
        .expect(400);
    });

    it('returns 400 for negative amount', async () => {
      return request(app.getHttpServer())
        .post('/mobile/client/payments/bank-transfer')
        .set('Authorization', 'Bearer fake-jwt')
        .attach('receipt', Buffer.from('receipt'), 'receipt.png')
        .field('invoiceId', invoiceId)
        .field('amount', '-10')
        .expect(400);
    });
  });
});
