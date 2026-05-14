import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MobileClientUpcomingController } from './upcoming.controller';
import { PrismaService } from '../../../../infrastructure/database';
import { ClientSessionGuard } from '../../../../common/guards/client-session.guard';

describe('MobileClientUpcomingController (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = {
    booking: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileClientUpcomingController],
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

  describe('GET /mobile/client/portal/upcoming', () => {
    it('returns 200 with upcoming bookings', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        { id: 'b-1', scheduledAt: '2026-12-31T09:00:00Z', status: 'CONFIRMED', employeeId: 'emp-1' },
      ]);
      mockPrisma.booking.count.mockResolvedValue(1);

      const res = await request(app.getHttpServer())
        .get('/mobile/client/portal/upcoming')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.totalPages).toBe(1);

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: 'client-1',
            status: { in: ['PENDING', 'CONFIRMED'] },
          }),
          orderBy: { scheduledAt: 'asc' },
          skip: 0,
          take: 10,
        }),
      );
    });

    it('passes pagination params', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.booking.count.mockResolvedValue(0);

      await request(app.getHttpServer())
        .get('/mobile/client/portal/upcoming?page=2&limit=5')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });

    it('returns empty list when no upcoming bookings', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.booking.count.mockResolvedValue(0);

      const res = await request(app.getHttpServer())
        .get('/mobile/client/portal/upcoming')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
      expect(res.body.meta.totalPages).toBe(0);
    });
  });
});
