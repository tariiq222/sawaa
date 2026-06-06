import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MobileEmployeeScheduleController } from './schedule.controller';
import { PrismaService } from '../../../infrastructure/database';
import { ListBookingsHandler } from '../../../modules/bookings/list-bookings/list-bookings.handler';
import { UpdateAvailabilityHandler } from '../../../modules/people/employees/update-availability.handler';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CaslGuard } from '../../../common/guards/casl.guard';

describe('MobileEmployeeScheduleController (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = {
    employee: { findFirst: jest.fn() },
  };
  const mockListBookings = { execute: jest.fn() };
  const mockUpdateAvailability = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileEmployeeScheduleController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ListBookingsHandler, useValue: mockListBookings },
        { provide: UpdateAvailabilityHandler, useValue: mockUpdateAvailability },
      ],
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

  beforeEach(() => {
    // JWT user carries sub = 'emp-1' (a User.id) and no employeeId claim, so the
    // controller resolves the real Employee.id via prisma.employee.findFirst.
    // Returning a DIFFERENT id ('employee-1') proves resolution actually happens.
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /mobile/employee/schedule/today', () => {
    it('returns 200 with today bookings', async () => {
      mockListBookings.execute.mockResolvedValue({ data: [{ id: 'b-1' }], total: 1 });

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/schedule/today')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(mockListBookings.execute).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 'employee-1', page: 1, limit: 50 }),
      );
    });
  });

  describe('GET /mobile/employee/schedule/weekly', () => {
    it('returns 200 with weekly bookings', async () => {
      mockListBookings.execute.mockResolvedValue({ data: [{ id: 'b-1' }], total: 1 });

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/schedule/weekly?fromDate=2026-05-01&toDate=2026-05-07')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(mockListBookings.execute).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 'employee-1', fromDate: expect.any(Date), toDate: expect.any(Date) }),
      );
    });

    it('returns 400 for invalid date', async () => {
      return request(app.getHttpServer())
        .get('/mobile/employee/schedule/weekly?fromDate=invalid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('PATCH /mobile/employee/schedule/availability', () => {
    it('returns 200 on availability update', async () => {
      mockUpdateAvailability.execute.mockResolvedValue({ employeeId: 'employee-1', windows: [] });

      const res = await request(app.getHttpServer())
        .patch('/mobile/employee/schedule/availability')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }] })
        .expect(200);

      expect(res.body.employeeId).toBe('employee-1');
      expect(mockUpdateAvailability.execute).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 'employee-1' }),
      );
    });
  });
});
