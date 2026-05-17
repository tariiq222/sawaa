import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardBookingsController } from './bookings.controller';
import { CreateBookingHandler } from '../../modules/bookings/create-booking/create-booking.handler';
import { CreateRecurringBookingHandler } from '../../modules/bookings/create-recurring-booking/create-recurring-booking.handler';
import { ListBookingsHandler } from '../../modules/bookings/list-bookings/list-bookings.handler';
import { BookingsStatsHandler } from '../../modules/bookings/bookings-stats/bookings-stats.handler';
import { GetBookingHandler } from '../../modules/bookings/get-booking/get-booking.handler';
import { CancelBookingHandler } from '../../modules/bookings/cancel-booking/cancel-booking.handler';
import { RescheduleBookingHandler } from '../../modules/bookings/reschedule-booking/reschedule-booking.handler';
import { ConfirmBookingHandler } from '../../modules/bookings/confirm-booking/confirm-booking.handler';
import { RetryZoomMeetingHandler } from '../../modules/bookings/retry-zoom-meeting/retry-zoom-meeting.handler';
import { CheckInBookingHandler } from '../../modules/bookings/check-in-booking/check-in-booking.handler';
import { CompleteBookingHandler } from '../../modules/bookings/complete-booking/complete-booking.handler';
import { NoShowBookingHandler } from '../../modules/bookings/no-show-booking/no-show-booking.handler';
import { AddToWaitlistHandler } from '../../modules/bookings/add-to-waitlist/add-to-waitlist.handler';
import { ListWaitlistHandler } from '../../modules/bookings/list-waitlist/list-waitlist.handler';
import { RemoveWaitlistEntryHandler } from '../../modules/bookings/remove-waitlist-entry/remove-waitlist-entry.handler';
import { CheckAvailabilityHandler } from '../../modules/bookings/check-availability/check-availability.handler';
import { ListBookingStatusLogHandler } from '../../modules/bookings/list-booking-status-log/list-booking-status-log.handler';
import { CreateBundleBookingHandler } from '../../modules/bookings/create-bundle-booking/create-bundle-booking.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardBookingsController (e2e)', () => {
  let app: INestApplication;

  const mockCreateBooking = { execute: jest.fn() };
  const mockCreateRecurring = { execute: jest.fn() };
  const mockListBookings = { execute: jest.fn() };
  const mockStats = { execute: jest.fn() };
  const mockGetBooking = { execute: jest.fn() };
  const mockCancel = { execute: jest.fn() };
  const mockReschedule = { execute: jest.fn() };
  const mockConfirm = { execute: jest.fn() };
  const mockRetryZoom = { execute: jest.fn() };
  const mockCheckIn = { execute: jest.fn() };
  const mockComplete = { execute: jest.fn() };
  const mockNoShow = { execute: jest.fn() };
  const mockAddWaitlist = { execute: jest.fn() };
  const mockListWaitlist = { execute: jest.fn() };
  const mockRemoveWaitlist = { execute: jest.fn() };
  const mockAvailability = { execute: jest.fn() };
  const mockStatusLog = { execute: jest.fn() };
  const mockCreateBundleBooking = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardBookingsController],
      providers: [
        { provide: CreateBookingHandler, useValue: mockCreateBooking },
        { provide: CreateRecurringBookingHandler, useValue: mockCreateRecurring },
        { provide: ListBookingsHandler, useValue: mockListBookings },
        { provide: BookingsStatsHandler, useValue: mockStats },
        { provide: GetBookingHandler, useValue: mockGetBooking },
        { provide: CancelBookingHandler, useValue: mockCancel },
        { provide: RescheduleBookingHandler, useValue: mockReschedule },
        { provide: ConfirmBookingHandler, useValue: mockConfirm },
        { provide: RetryZoomMeetingHandler, useValue: mockRetryZoom },
        { provide: CheckInBookingHandler, useValue: mockCheckIn },
        { provide: CompleteBookingHandler, useValue: mockComplete },
        { provide: NoShowBookingHandler, useValue: mockNoShow },
        { provide: AddToWaitlistHandler, useValue: mockAddWaitlist },
        { provide: ListWaitlistHandler, useValue: mockListWaitlist },
        { provide: RemoveWaitlistEntryHandler, useValue: mockRemoveWaitlist },
        { provide: CheckAvailabilityHandler, useValue: mockAvailability },
        { provide: ListBookingStatusLogHandler, useValue: mockStatusLog },
        { provide: CreateBundleBookingHandler, useValue: mockCreateBundleBooking },
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
            organizationId: '00000000-0000-4000-a000-000000000001',
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

  const validBooking = {
    branchId: '00000000-0000-4000-a000-000000000001',
    clientId: '00000000-0000-4000-a000-000000000002',
    employeeId: '00000000-0000-4000-a000-000000000003',
    serviceId: '00000000-0000-4000-a000-000000000004',
    scheduledAt: '2026-12-31T09:00:00Z',
  };

  describe('POST /dashboard/bookings', () => {
    it('returns 201 on valid booking creation', async () => {
      mockCreateBooking.execute.mockResolvedValue({ id: 'booking-1', status: 'PENDING' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/bookings')
        .set('Authorization', 'Bearer fake-jwt')
        .send(validBooking)
        .expect(201);

      expect(res.body.id).toBe('booking-1');
    });

    it('returns 400 for missing required fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/bookings')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ branchId: validBooking.branchId })
        .expect(400);
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/bookings')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validBooking, serviceId: 'not-a-uuid' })
        .expect(400);
    });

    it('returns 400 for invalid date', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/bookings')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validBooking, scheduledAt: 'tomorrow' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/bookings')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validBooking, extra: 'bad' })
        .expect(400);
    });
  });

  describe('GET /dashboard/bookings', () => {
    it('returns 200 with paginated bookings', async () => {
      mockListBookings.execute.mockResolvedValue({
        data: [{ id: 'b-1', status: 'CONFIRMED' }],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/bookings')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(mockListBookings.execute).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20, userId: 'user-1' }),
      );
    });

    it('passes query filters to handler', async () => {
      mockListBookings.execute.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });

      await request(app.getHttpServer())
        .get('/dashboard/bookings?clientId=00000000-0000-4000-a000-000000000001&fromDate=2026-01-01T00:00:00Z')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);
      expect(mockListBookings.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: '00000000-0000-4000-a000-000000000001',
          fromDate: expect.any(Date),
          userId: 'user-1',
        }),
      );
    });
  });

  describe('GET /dashboard/bookings/stats', () => {
    it('returns 200 with booking stats', async () => {
      mockStats.execute.mockResolvedValue({ todayCount: 5, pendingCount: 2, completedToday: 3, revenueToday: 1500 });

      const res = await request(app.getHttpServer())
        .get('/dashboard/bookings/stats')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.todayCount).toBe(5);
    });
  });

  describe('GET /dashboard/bookings/:id', () => {
    it('returns 200 with booking details', async () => {
      mockGetBooking.execute.mockResolvedValue({ id: 'b-1', status: 'CONFIRMED', clientId: 'c-1' });

      const res = await request(app.getHttpServer())
        .get('/dashboard/bookings/00000000-0000-4000-a000-000000000001')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.id).toBe('b-1');
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/bookings/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('PATCH /dashboard/bookings/:id/cancel', () => {
    it('returns 200 on cancel', async () => {
      mockCancel.execute.mockResolvedValue({ id: 'b-1', status: 'CANCELLED' });

      const res = await request(app.getHttpServer())
        .patch('/dashboard/bookings/00000000-0000-4000-a000-000000000001/cancel')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ reason: 'CLIENT_REQUESTED' })
        .expect(200);
      expect(res.body.status).toBe('CANCELLED');
    });
  });

  describe('PATCH /dashboard/bookings/:id/confirm', () => {
    it('returns 200 on confirm', async () => {
      mockConfirm.execute.mockResolvedValue({ id: 'b-1', status: 'CONFIRMED' });

      const res = await request(app.getHttpServer())
        .patch('/dashboard/bookings/00000000-0000-4000-a000-000000000001/confirm')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.status).toBe('CONFIRMED');
    });
  });

  describe('PATCH /dashboard/bookings/:id/check-in', () => {
    it('returns 200 on check-in', async () => {
      mockCheckIn.execute.mockResolvedValue({ id: 'b-1', status: 'CHECKED_IN' });

      const res = await request(app.getHttpServer())
        .patch('/dashboard/bookings/00000000-0000-4000-a000-000000000001/check-in')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.status).toBe('CHECKED_IN');
    });
  });

  describe('PATCH /dashboard/bookings/:id/complete', () => {
    it('returns 200 on complete', async () => {
      mockComplete.execute.mockResolvedValue({ id: 'b-1', status: 'COMPLETED' });

      const res = await request(app.getHttpServer())
        .patch('/dashboard/bookings/00000000-0000-4000-a000-000000000001/complete')
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(200);

      expect(res.body.status).toBe('COMPLETED');
    });
  });

  describe('PATCH /dashboard/bookings/:id/no-show', () => {
    it('returns 200 on no-show', async () => {
      mockNoShow.execute.mockResolvedValue({ id: 'b-1', status: 'NO_SHOW' });

      const res = await request(app.getHttpServer())
        .patch('/dashboard/bookings/00000000-0000-4000-a000-000000000001/no-show')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.status).toBe('NO_SHOW');
    });
  });

  describe('GET /dashboard/bookings/availability', () => {
    it('returns 200 with available slots', async () => {
      mockAvailability.execute.mockResolvedValue([{ startTime: '09:00', endTime: '10:00' }]);

      const res = await request(app.getHttpServer())
        .get('/dashboard/bookings/availability?date=2026-12-31T00:00:00Z&employeeId=00000000-0000-4000-a000-000000000001&branchId=00000000-0000-4000-a000-000000000002')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);
      expect(res.body).toHaveLength(1);
    });
  });
});
