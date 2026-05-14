import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardStatsController } from './stats.controller';
import { GetDashboardStatsHandler } from '../../modules/dashboard/get-dashboard-stats/get-dashboard-stats.handler';
import { GetTopPerformersHandler } from '../../modules/dashboard/get-top-performers/get-top-performers.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardStatsController (e2e)', () => {
  let app: INestApplication;

  const mockGetStats = { execute: jest.fn() };
  const mockGetTopPerformers = { execute: jest.fn() };

  const buildUser = (role = 'ADMIN', membershipRole?: string) => ({
    sub: 'user-1',
    id: 'user-1',
    email: 'admin@example.com',
    role,
    membershipRole: membershipRole ?? role,
    isSuperAdmin: false,
    organizationId: '00000000-0000-0000-0000-000000000001',
  });

  const buildApp = async (user: any) => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardStatsController],
      providers: [
        { provide: GetDashboardStatsHandler, useValue: mockGetStats },
        { provide: GetTopPerformersHandler, useValue: mockGetTopPerformers },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = user;
          return true;
        },
      })
      .overrideGuard(CaslGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const nestApp = moduleRef.createNestApplication();
    nestApp.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await nestApp.init();
    return nestApp;
  };

  beforeEach(async () => {
    app = await buildApp(buildUser());
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /dashboard/stats', () => {
    it('returns 200 with dashboard statistics', async () => {
      mockGetStats.execute.mockResolvedValue({
        todayBookings: 12,
        pendingBookings: 3,
        completedToday: 9,
        revenueToday: 3450,
        activeClients: 120,
        newClientsThisMonth: 15,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.todayBookings).toBe(12);
      expect(res.body.revenueToday).toBe(3450);
      expect(mockGetStats.execute).toHaveBeenCalledWith({
        userId: 'user-1',
        role: 'ADMIN',
      });
    });
  });

  describe('GET /dashboard/top-performers', () => {
    it('returns 200 with top performers for default period', async () => {
      mockGetTopPerformers.execute.mockResolvedValue([
        { employeeId: 'emp-1', name: 'Ali', revenue: 5000, bookings: 10 },
      ]);

      const res = await request(app.getHttpServer())
        .get('/dashboard/top-performers')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Ali');
      expect(mockGetTopPerformers.execute).toHaveBeenCalledWith({ period: 'month' });
    });

    it('returns 200 with top performers for explicit period', async () => {
      mockGetTopPerformers.execute.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/dashboard/top-performers?period=month')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockGetTopPerformers.execute).toHaveBeenCalledWith({ period: 'month' });
    });

    it('returns 400 for invalid period value', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/top-performers?period=invalid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });

    it('returns 403 for ACCOUNTANT role', async () => {
      const accountantApp = await buildApp(buildUser('ADMIN', 'ACCOUNTANT'));

      await request(accountantApp.getHttpServer())
        .get('/dashboard/top-performers')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(403);

      await accountantApp.close();
    });
  });
});
