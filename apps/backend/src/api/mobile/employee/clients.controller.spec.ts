import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MobileEmployeeClientsController } from './clients.controller';
import { PrismaService } from '../../../infrastructure/database';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CaslGuard } from '../../../common/guards/casl.guard';

describe('MobileEmployeeClientsController (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = {
    booking: { findMany: jest.fn() },
    client: { findMany: jest.fn(), count: jest.fn() },
    employee: { findFirst: jest.fn() },
  };

  const buildApp = async (user: any) => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileEmployeeClientsController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
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

  const uuid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;

  beforeEach(async () => {
    app = await buildApp({
      sub: 'user-1',
      id: 'user-1',
      email: 'emp@example.com',
      role: 'EMPLOYEE',
      isSuperAdmin: false,
    });
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /mobile/employee/clients', () => {
    it('returns 200 with client list', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
      mockPrisma.booking.findMany.mockResolvedValue([{ clientId: uuid(1) }, { clientId: uuid(2) }]);
      mockPrisma.client.findMany.mockResolvedValue([
        { id: uuid(1), name: 'Sara' },
        { id: uuid(2), name: 'Ali' },
      ]);
      mockPrisma.client.count.mockResolvedValue(2);

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/clients')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('passes search query to prisma', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
      mockPrisma.booking.findMany.mockResolvedValue([{ clientId: uuid(1) }]);
      mockPrisma.client.findMany.mockResolvedValue([{ id: uuid(1), name: 'Sara' }]);
      mockPrisma.client.count.mockResolvedValue(1);

      await request(app.getHttpServer())
        .get('/mobile/employee/clients?search=Sara')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('GET /mobile/employee/clients/:clientId/history', () => {
    it('returns 200 with booking history', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
      mockPrisma.booking.findMany.mockResolvedValue([
        { id: uuid(3), scheduledAt: new Date(), status: 'COMPLETED' },
      ]);

      const res = await request(app.getHttpServer())
        .get(`/mobile/employee/clients/${uuid(1)}/history`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(1);
    });

    it('returns 400 for invalid client UUID', async () => {
      return request(app.getHttpServer())
        .get('/mobile/employee/clients/not-a-uuid/history')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });
});
