import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MobileClientSummaryController } from './summary.controller';
import { PrismaService } from '../../../../infrastructure/database';
import { ClientSessionGuard } from '../../../../common/guards/client-session.guard';

describe('MobileClientSummaryController (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = {
    booking: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    invoice: {
      aggregate: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileClientSummaryController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /mobile/client/portal/summary', () => {
    it('returns 200 with summary stats', async () => {
      mockPrisma.booking.count.mockResolvedValue(8);
      mockPrisma.booking.findFirst.mockResolvedValue({ scheduledAt: '2026-05-01T10:00:00Z' });
      mockPrisma.invoice.aggregate.mockResolvedValue({ _sum: { total: 250 } });

      const res = await request(app.getHttpServer())
        .get('/mobile/client/portal/summary')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.totalBookings).toBe(8);
      expect(res.body.lastVisit).toBe('2026-05-01T10:00:00Z');
      expect(res.body.outstandingBalance).toBe(250);

      expect(mockPrisma.booking.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientId: 'client-1' } }),
      );
    });

    it('returns null lastVisit when no completed bookings', async () => {
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.invoice.aggregate.mockResolvedValue({ _sum: { total: null } });

      const res = await request(app.getHttpServer())
        .get('/mobile/client/portal/summary')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.totalBookings).toBe(0);
      expect(res.body.lastVisit).toBeNull();
      expect(res.body.outstandingBalance).toBe(0);
    });
  });
});
