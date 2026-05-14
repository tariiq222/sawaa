import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RefundsController } from './refunds.controller';
import { ListRefundsHandler } from '../../modules/finance/refund-payment/list-refunds.handler';
import { ApproveRefundHandler } from '../../modules/finance/refund-payment/approve-refund.handler';
import { DenyRefundHandler } from '../../modules/finance/refund-payment/deny-refund.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('RefundsController (e2e)', () => {
  let app: INestApplication;

  const mockListRefunds = { execute: jest.fn() };
  const mockApproveRefund = { execute: jest.fn() };
  const mockDenyRefund = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RefundsController],
      providers: [
        { provide: ListRefundsHandler, useValue: mockListRefunds },
        { provide: ApproveRefundHandler, useValue: mockApproveRefund },
        { provide: DenyRefundHandler, useValue: mockDenyRefund },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = {
            sub: 'user-1',
            id: 'user-1',
            email: 'admin@example.com',
            role: 'ADMIN',
            isSuperAdmin: false,
          };
          return true;
        },
      })
      .overrideGuard(CaslGuard)
      .useValue({ canActivate: () => true })
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

  describe('GET /dashboard/refunds', () => {
    it('returns 200 with refund list', async () => {
      mockListRefunds.execute.mockResolvedValue({ data: [{ id: 'ref-1' }], total: 1 });

      const res = await request(app.getHttpServer())
        .get('/dashboard/refunds')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(mockListRefunds.execute).toHaveBeenCalledWith(undefined);
    });

    it('passes status filter to handler', async () => {
      mockListRefunds.execute.mockResolvedValue({ data: [], total: 0 });

      await request(app.getHttpServer())
        .get('/dashboard/refunds?status=PENDING')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListRefunds.execute).toHaveBeenCalledWith('PENDING');
    });
  });

  describe('POST /dashboard/refunds/approve', () => {
    it('returns 201 on approve', async () => {
      mockApproveRefund.execute.mockResolvedValue({ id: 'ref-1', status: 'APPROVED' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/refunds/approve')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ refundRequestId: 'ref-1' })
        .expect(201);

      expect(res.body.status).toBe('APPROVED');
      expect(mockApproveRefund.execute).toHaveBeenCalledWith(
        expect.objectContaining({ refundRequestId: 'ref-1', approvedBy: 'user-1' }),
      );
    });
  });

  describe('POST /dashboard/refunds/deny', () => {
    it('returns 201 on deny', async () => {
      mockDenyRefund.execute.mockResolvedValue({ id: 'ref-1', status: 'DENIED' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/refunds/deny')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ refundRequestId: 'ref-1', reason: 'Policy violation' })
        .expect(201);

      expect(res.body.status).toBe('DENIED');
      expect(mockDenyRefund.execute).toHaveBeenCalledWith(
        expect.objectContaining({ refundRequestId: 'ref-1', deniedBy: 'user-1', reason: 'Policy violation' }),
      );
    });
  });
});
