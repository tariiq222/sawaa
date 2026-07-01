import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardBookingsController } from './bookings.controller';
import { CreateBookingHandler } from '../../modules/bookings/create-booking/create-booking.handler';
import { ListBookingsHandler } from '../../modules/bookings/list-bookings/list-bookings.handler';
import { BookingsStatsHandler } from '../../modules/bookings/bookings-stats/bookings-stats.handler';
import { GetBookingHandler } from '../../modules/bookings/get-booking/get-booking.handler';
import { CancelBookingHandler } from '../../modules/bookings/cancel-booking/cancel-booking.handler';
import { DeleteBookingHandler } from '../../modules/bookings/delete-booking/delete-booking.handler';
import { RescheduleBookingHandler } from '../../modules/bookings/reschedule-booking/reschedule-booking.handler';
import { ConfirmBookingHandler } from '../../modules/bookings/confirm-booking/confirm-booking.handler';
import { RetryZoomMeetingHandler } from '../../modules/bookings/retry-zoom-meeting/retry-zoom-meeting.handler';
import { CheckInBookingHandler } from '../../modules/bookings/check-in-booking/check-in-booking.handler';
import { CompleteBookingHandler } from '../../modules/bookings/complete-booking/complete-booking.handler';
import { NoShowBookingHandler } from '../../modules/bookings/no-show-booking/no-show-booking.handler';
import { CheckAvailabilityHandler } from '../../modules/bookings/check-availability/check-availability.handler';
import { ListBookingStatusLogHandler } from '../../modules/bookings/list-booking-status-log/list-booking-status-log.handler';
import { GetBookingTimelineHandler } from '../../modules/bookings/get-booking-timeline/get-booking-timeline.handler';
import { ApproveCancelBookingHandler } from '../../modules/bookings/approve-cancel-booking/approve-cancel-booking.handler';
import { RejectCancelBookingHandler } from '../../modules/bookings/reject-cancel-booking/reject-cancel-booking.handler';
import { BookFromCreditHandler } from '../../modules/bookings/book-from-credit/book-from-credit.handler';
import { GetMatchingCreditsHandler } from '../../modules/bookings/get-matching-credits/get-matching-credits.handler';
import { TransferCreditHandler } from '../../modules/bookings/transfer-credit/transfer-credit.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardBookingsController (e2e)', () => {
  let app: INestApplication;

  const mockCreateBooking = { execute: jest.fn() };
  const mockListBookings = { execute: jest.fn() };
  const mockStats = { execute: jest.fn() };
  const mockGetBooking = { execute: jest.fn() };
  const mockCancel = { execute: jest.fn() };
  const mockDelete = { execute: jest.fn() };
  const mockReschedule = { execute: jest.fn() };
  const mockConfirm = { execute: jest.fn() };
  const mockRetryZoom = { execute: jest.fn() };
  const mockCheckIn = { execute: jest.fn() };
  const mockComplete = { execute: jest.fn() };
  const mockNoShow = { execute: jest.fn() };
  const mockAvailability = { execute: jest.fn() };
  const mockStatusLog = { execute: jest.fn() };
  const mockTimeline = { execute: jest.fn() };
  const mockApproveCancel = { execute: jest.fn() };
  const mockRejectCancel = { execute: jest.fn() };
  const mockBookFromCredit = { execute: jest.fn() };
  const mockMatchingCredits = { execute: jest.fn() };
  const mockTransferCredit = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardBookingsController],
      providers: [
        { provide: CreateBookingHandler, useValue: mockCreateBooking },
        { provide: ListBookingsHandler, useValue: mockListBookings },
        { provide: BookingsStatsHandler, useValue: mockStats },
        { provide: GetBookingHandler, useValue: mockGetBooking },
        { provide: CancelBookingHandler, useValue: mockCancel },
        { provide: DeleteBookingHandler, useValue: mockDelete },
        { provide: RescheduleBookingHandler, useValue: mockReschedule },
        { provide: ConfirmBookingHandler, useValue: mockConfirm },
        { provide: RetryZoomMeetingHandler, useValue: mockRetryZoom },
        { provide: CheckInBookingHandler, useValue: mockCheckIn },
        { provide: CompleteBookingHandler, useValue: mockComplete },
        { provide: NoShowBookingHandler, useValue: mockNoShow },
        { provide: CheckAvailabilityHandler, useValue: mockAvailability },
        { provide: ListBookingStatusLogHandler, useValue: mockStatusLog },
        { provide: GetBookingTimelineHandler, useValue: mockTimeline },
        { provide: ApproveCancelBookingHandler, useValue: mockApproveCancel },
        { provide: RejectCancelBookingHandler, useValue: mockRejectCancel },
        { provide: BookFromCreditHandler, useValue: mockBookFromCredit },
        { provide: GetMatchingCreditsHandler, useValue: mockMatchingCredits },
        { provide: TransferCreditHandler, useValue: mockTransferCredit },
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

  describe('POST /dashboard/bookings/from-credit', () => {
    const fromCreditBody = {
      clientId: '00000000-0000-4000-a000-000000000001',
      creditId: '00000000-0000-4000-a000-000000000006',
      branchId: '00000000-0000-4000-a000-000000000002',
      scheduledAt: '2026-12-31T09:00:00Z',
    };

    it('returns 201 and converts scheduledAt to a Date for the handler', async () => {
      mockBookFromCredit.execute.mockResolvedValue({ id: 'booking-credit-1', status: 'CONFIRMED' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/bookings/from-credit')
        .set('Authorization', 'Bearer fake-jwt')
        .send(fromCreditBody)
        .expect(201);

      expect(res.body.id).toBe('booking-credit-1');
      expect(mockBookFromCredit.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: fromCreditBody.clientId,
          creditId: fromCreditBody.creditId,
          branchId: fromCreditBody.branchId,
          scheduledAt: expect.any(Date),
          userId: 'user-1',
        }),
      );
    });

    it('accepts the (serviceId, employeeId, durationOptionId) triple without creditId', async () => {
      mockBookFromCredit.execute.mockResolvedValue({ id: 'booking-credit-2' });

      await request(app.getHttpServer())
        .post('/dashboard/bookings/from-credit')
        .set('Authorization', 'Bearer fake-jwt')
        .send({
          clientId: '00000000-0000-4000-a000-000000000001',
          serviceId: '00000000-0000-4000-a000-000000000004',
          employeeId: '00000000-0000-4000-a000-000000000003',
          durationOptionId: '00000000-0000-4000-a000-000000000005',
          branchId: '00000000-0000-4000-a000-000000000002',
          scheduledAt: '2026-12-31T09:00:00Z',
        })
        .expect(201);
    });

    it('returns 400 for an invalid scheduledAt', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/bookings/from-credit')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...fromCreditBody, scheduledAt: 'not-a-date' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/bookings/from-credit')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...fromCreditBody, extra: 'bad' })
        .expect(400);
    });
  });

  describe('GET /dashboard/bookings/matching-credits', () => {
    it('returns 200 with matching credits and passes the query to the handler', async () => {
      mockMatchingCredits.execute.mockResolvedValue([{ creditId: 'c-1', remaining: 3 }]);

      const res = await request(app.getHttpServer())
        .get(
          '/dashboard/bookings/matching-credits' +
            '?clientId=00000000-0000-4000-a000-000000000001' +
            '&serviceId=00000000-0000-4000-a000-000000000004' +
            '&employeeId=00000000-0000-4000-a000-000000000003' +
            '&durationOptionId=00000000-0000-4000-a000-000000000005',
        )
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(mockMatchingCredits.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: '00000000-0000-4000-a000-000000000001',
          serviceId: '00000000-0000-4000-a000-000000000004',
          employeeId: '00000000-0000-4000-a000-000000000003',
          durationOptionId: '00000000-0000-4000-a000-000000000005',
        }),
      );
    });

    it('returns 400 when a required query param is missing', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/bookings/matching-credits?clientId=00000000-0000-4000-a000-000000000001')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('POST /dashboard/bookings/credits/:creditId/transfer', () => {
    const CREDIT_ID = '00000000-0000-4000-a000-000000000006';
    const TO_EMPLOYEE_ID = '00000000-0000-4000-a000-000000000099';

    it('returns 201 and forwards creditId + toEmployeeId + acting user to the handler', async () => {
      mockTransferCredit.execute.mockResolvedValue({ id: CREDIT_ID, employeeId: TO_EMPLOYEE_ID });

      const res = await request(app.getHttpServer())
        .post(`/dashboard/bookings/credits/${CREDIT_ID}/transfer`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ toEmployeeId: TO_EMPLOYEE_ID })
        .expect(201);

      expect(res.body.employeeId).toBe(TO_EMPLOYEE_ID);
      expect(mockTransferCredit.execute).toHaveBeenCalledWith({
        creditId: CREDIT_ID,
        toEmployeeId: TO_EMPLOYEE_ID,
        userId: 'user-1',
      });
    });

    it('returns 400 when toEmployeeId is not a UUID', async () => {
      return request(app.getHttpServer())
        .post(`/dashboard/bookings/credits/${CREDIT_ID}/transfer`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ toEmployeeId: 'not-a-uuid' })
        .expect(400);
    });

    it('returns 400 when the creditId path param is not a UUID', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/bookings/credits/not-a-uuid/transfer')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ toEmployeeId: TO_EMPLOYEE_ID })
        .expect(400);
    });
  });
});
