import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MobileEmployeeEarningsController } from './earnings.controller';
import { PrismaService } from '../../../infrastructure/database';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CaslGuard } from '../../../common/guards/casl.guard';

describe('MobileEmployeeEarningsController (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = {
    invoice: {
      findMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileEmployeeEarningsController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = {
            sub: 'emp-1',
            id: 'emp-1',
            email: 'emp@example.com',
            role: 'EMPLOYEE',
            isSuperAdmin: false,
          };
          return true;
        },
      })
      .overrideGuard(CaslGuard)
      .useValue({ canActivate: () => true })
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

  describe('GET /mobile/employee/earnings', () => {
    it('returns 200 with earnings summary', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          total: 100,
          payments: [
            { amount: 50, method: 'ONLINE_CARD' },
            { amount: 50, method: 'CASH' },
          ],
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/earnings?from=2026-01-01&to=2026-01-31')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.totalEarnings).toBe(100);
      expect(res.body.invoiceCount).toBe(1);
      expect(res.body.byMethod).toEqual({ ONLINE_CARD: 50, CASH: 50 });
    });

    it('returns 200 with default date range when no query', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/earnings')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.totalEarnings).toBe(0);
      expect(res.body.invoiceCount).toBe(0);
    });

    it('returns 400 for invalid date', async () => {
      return request(app.getHttpServer())
        .get('/mobile/employee/earnings?from=not-a-date')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });
});
