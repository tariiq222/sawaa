import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PublicRefundsController } from './refunds.controller';
import { RequestRefundHandler } from '../../modules/finance/refund-payment/request-refund.handler';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';

describe('PublicRefundsController (e2e)', () => {
  let app: INestApplication;

  const mockRequestRefund = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicRefundsController],
      providers: [{ provide: RequestRefundHandler, useValue: mockRequestRefund }],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = { id: 'client-1', email: 'client@example.com' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /public/refunds/request', () => {
    it('returns 201 on valid refund request', async () => {
      mockRequestRefund.execute.mockResolvedValue({ id: 'req-1', status: 'PENDING' });

      const res = await request(app.getHttpServer())
        .post('/public/refunds/request')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ invoiceId: 'inv-1', reason: 'Changed my mind' })
        .expect(201);

      expect(res.body.status).toBe('PENDING');
      expect(mockRequestRefund.execute).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: 'inv-1', reason: 'Changed my mind', clientId: 'client-1' }),
      );
    });

    it('returns 401 without client session', async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        controllers: [PublicRefundsController],
        providers: [{ provide: RequestRefundHandler, useValue: mockRequestRefund }],
      })
        .overrideGuard(ClientSessionGuard)
        .useValue({ canActivate: () => false })
        .compile();

      const guardedApp = moduleRef.createNestApplication();
      await guardedApp.init();

      await request(guardedApp.getHttpServer())
        .post('/public/refunds/request')
        .send({ invoiceId: 'inv-1' })
        .expect(403);

      await guardedApp.close();
    });
  });
});
