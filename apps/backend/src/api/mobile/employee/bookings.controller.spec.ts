import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MobileEmployeeBookingsController } from './bookings.controller';
import { PrismaService } from '../../../infrastructure/database';
import { ListBookingsHandler } from '../../../modules/bookings/list-bookings/list-bookings.handler';
import { GetBookingHandler } from '../../../modules/bookings/get-booking/get-booking.handler';
import { CheckInBookingHandler } from '../../../modules/bookings/check-in-booking/check-in-booking.handler';
import { CompleteBookingHandler } from '../../../modules/bookings/complete-booking/complete-booking.handler';
import { CancelBookingHandler } from '../../../modules/bookings/cancel-booking/cancel-booking.handler';
import { RequestCancelBookingHandler } from '../../../modules/bookings/request-cancel-booking/request-cancel-booking.handler';
import { CreateEmployeeBookingHandler } from '../../../modules/bookings/create-employee-booking/create-employee-booking.handler';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CaslGuard } from '../../../common/guards/casl.guard';

describe('MobileEmployeeBookingsController (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = {
    booking: {
      findFirst: jest.fn(),
    },
  };
  const mockListBookings = { execute: jest.fn() };
  const mockGetBooking = { execute: jest.fn() };
  const mockCheckIn = { execute: jest.fn() };
  const mockComplete = { execute: jest.fn() };
  const mockCancel = { execute: jest.fn() };
  const mockRequestCancel = { execute: jest.fn() };
  const mockCreateEmployeeBooking = { execute: jest.fn() };

  const buildApp = async (user: any) => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileEmployeeBookingsController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ListBookingsHandler, useValue: mockListBookings },
        { provide: GetBookingHandler, useValue: mockGetBooking },
        { provide: CheckInBookingHandler, useValue: mockCheckIn },
        { provide: CompleteBookingHandler, useValue: mockComplete },
        { provide: CancelBookingHandler, useValue: mockCancel },
        { provide: RequestCancelBookingHandler, useValue: mockRequestCancel },
        { provide: CreateEmployeeBookingHandler, useValue: mockCreateEmployeeBooking },
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

  const uuid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;

  beforeEach(async () => {
    app = await buildApp({
      sub: 'emp-1',
      id: 'emp-1',
      email: 'emp@example.com',
      role: 'EMPLOYEE',
      isSuperAdmin: false,
    });
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /mobile/employee/bookings', () => {
    it('returns 200 with employee bookings', async () => {
      mockListBookings.execute.mockResolvedValue({ data: [{ id: uuid(1) }], total: 1 });

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/bookings')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(mockListBookings.execute).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 'emp-1', page: 1, limit: 20 }),
      );
    });
  });

  describe('GET /mobile/employee/bookings/:id', () => {
    it('returns 200 when booking is owned', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ id: uuid(1), employeeId: 'emp-1' });
      mockGetBooking.execute.mockResolvedValue({ id: uuid(1), status: 'CONFIRMED' });

      const res = await request(app.getHttpServer())
        .get(`/mobile/employee/bookings/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.status).toBe('CONFIRMED');
    });

    it('returns 404 when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get(`/mobile/employee/bookings/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(404);
    });

    it('returns 403 when booking belongs to another employee', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ id: uuid(1), employeeId: 'emp-2' });

      return request(app.getHttpServer())
        .get(`/mobile/employee/bookings/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(403);
    });
  });

  describe('POST /mobile/employee/bookings/:id/start', () => {
    it('returns 200 on start (check-in)', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ id: uuid(1), employeeId: 'emp-1' });
      mockCheckIn.execute.mockResolvedValue({ id: uuid(1), status: 'CHECKED_IN' });

      const res = await request(app.getHttpServer())
        .post(`/mobile/employee/bookings/${uuid(1)}/start`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.status).toBe('CHECKED_IN');
    });
  });

  describe('POST /mobile/employee/bookings/:id/complete', () => {
    it('returns 200 on complete', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ id: uuid(1), employeeId: 'emp-1' });
      mockComplete.execute.mockResolvedValue({ id: uuid(1), status: 'COMPLETED' });

      const res = await request(app.getHttpServer())
        .post(`/mobile/employee/bookings/${uuid(1)}/complete`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(200);

      expect(res.body.status).toBe('COMPLETED');
    });
  });

  describe('POST /mobile/employee/bookings/:id/employee-cancel', () => {
    it('returns 200 on cancel', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ id: uuid(1), employeeId: 'emp-1' });
      mockCancel.execute.mockResolvedValue({ id: uuid(1), status: 'CANCELLED' });

      const res = await request(app.getHttpServer())
        .post(`/mobile/employee/bookings/${uuid(1)}/employee-cancel`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ reason: 'EMPLOYEE_UNAVAILABLE' })
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
    });
  });

  describe('POST /mobile/employee/bookings/:id/cancel-request', () => {
    it('returns 200 on cancel request', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ id: uuid(1), employeeId: 'emp-1' });
      mockRequestCancel.execute.mockResolvedValue({ id: uuid(1), status: 'CANCEL_REQUESTED' });

      const res = await request(app.getHttpServer())
        .post(`/mobile/employee/bookings/${uuid(1)}/cancel-request`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ reason: 'EMPLOYEE_UNAVAILABLE' })
        .expect(200);

      expect(res.body.status).toBe('CANCEL_REQUESTED');
    });
  });
});
