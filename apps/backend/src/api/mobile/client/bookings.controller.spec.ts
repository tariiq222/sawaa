import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MobileClientBookingsController } from './bookings.controller';
import { ListBookingsHandler } from '../../../modules/bookings/list-bookings/list-bookings.handler';
import { GetBookingHandler } from '../../../modules/bookings/get-booking/get-booking.handler';
import { CreateBookingHandler } from '../../../modules/bookings/create-booking/create-booking.handler';
import { CancelBookingHandler } from '../../../modules/bookings/cancel-booking/cancel-booking.handler';
import { RescheduleBookingHandler } from '../../../modules/bookings/reschedule-booking/reschedule-booking.handler';
import { SubmitRatingHandler } from '../../../modules/org-experience/ratings/submit-rating.handler';
import { CreateZoomMeetingHandler } from '../../../modules/bookings/create-zoom-meeting/create-zoom-meeting.handler';
import { PrismaService } from '../../../infrastructure/database';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';

describe('MobileClientBookingsController (e2e)', () => {
  let app: INestApplication;

  const mockList = { execute: jest.fn() };
  const mockGet = { execute: jest.fn() };
  const mockCreate = { execute: jest.fn() };
  const mockCancel = { execute: jest.fn() };
  const mockReschedule = { execute: jest.fn() };
  const mockRate = { execute: jest.fn() };
  const mockZoom = { execute: jest.fn() };

  const mockPrisma = {
    booking: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileClientBookingsController],
      providers: [
        { provide: ListBookingsHandler, useValue: mockList },
        { provide: GetBookingHandler, useValue: mockGet },
        { provide: CreateBookingHandler, useValue: mockCreate },
        { provide: CancelBookingHandler, useValue: mockCancel },
        { provide: RescheduleBookingHandler, useValue: mockReschedule },
        { provide: SubmitRatingHandler, useValue: mockRate },
        { provide: CreateZoomMeetingHandler, useValue: mockZoom },
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

  const bookingId = '00000000-0000-4000-a000-000000000001';
  const validBooking = {
    branchId: '00000000-0000-4000-a000-000000000002',
    employeeId: '00000000-0000-4000-a000-000000000003',
    serviceId: '00000000-0000-4000-a000-000000000004',
    scheduledAt: '2026-12-31T09:00:00.000Z',
  };

  describe('POST /mobile/client/bookings', () => {
    it('returns 201 on valid create', async () => {
      mockCreate.execute.mockResolvedValue({ id: 'b-1', status: 'PENDING' });

      const res = await request(app.getHttpServer())
        .post('/mobile/client/bookings')
        .set('Authorization', 'Bearer fake-jwt')
        .send(validBooking)
        .expect(201);

      expect(res.body.id).toBe('b-1');
    });

    it('returns 400 for missing required fields', async () => {
      return request(app.getHttpServer())
        .post('/mobile/client/bookings')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ branchId: validBooking.branchId })
        .expect(400);
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .post('/mobile/client/bookings')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validBooking, serviceId: 'not-a-uuid' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/mobile/client/bookings')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validBooking, extra: 'bad' })
        .expect(400);
    });
  });

  describe('GET /mobile/client/bookings', () => {
    it('returns 200 with paginated bookings', async () => {
      mockList.execute.mockResolvedValue({ data: [{ id: 'b-1' }], total: 1, page: 1, limit: 20 });

      const res = await request(app.getHttpServer())
        .get('/mobile/client/bookings')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });

    it('passes query filters', async () => {
      mockList.execute.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

      await request(app.getHttpServer())
        .get('/mobile/client/bookings?status=CONFIRMED&page=2&limit=10')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockList.execute).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'client-1', status: 'CONFIRMED', page: 2, limit: 10 }),
      );
    });
  });

  describe('GET /mobile/client/bookings/:id', () => {
    it('returns 200 with booking details', async () => {
      mockGet.execute.mockResolvedValue({ id: bookingId, status: 'CONFIRMED' });

      const res = await request(app.getHttpServer())
        .get(`/mobile/client/bookings/${bookingId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.status).toBe('CONFIRMED');
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/mobile/client/bookings/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('PATCH /mobile/client/bookings/:id/cancel', () => {
    it('returns 200 on cancel', async () => {
      mockCancel.execute.mockResolvedValue({ id: bookingId, status: 'CANCELLED' });

      const res = await request(app.getHttpServer())
        .patch(`/mobile/client/bookings/${bookingId}/cancel`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ reason: 'CLIENT_REQUESTED' })
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
    });

    it('returns 400 for invalid reason', async () => {
      return request(app.getHttpServer())
        .patch(`/mobile/client/bookings/${bookingId}/cancel`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ reason: 'INVALID_REASON' })
        .expect(400);
    });
  });

  describe('GET /mobile/client/bookings/:id/join', () => {
    it('returns 200 with existing zoom url', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: bookingId,
        clientId: 'client-1',
        bookingType: 'ONLINE',
        zoomJoinUrl: 'https://zoom.us/j/123',
        scheduledAt: '2026-12-31T09:00:00Z',
      });

      const res = await request(app.getHttpServer())
        .get(`/mobile/client/bookings/${bookingId}/join`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.joinUrl).toBe('https://zoom.us/j/123');
    });

    it('returns 403 for non-online booking', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: bookingId,
        clientId: 'client-1',
        bookingType: 'INDIVIDUAL',
        zoomJoinUrl: null,
        scheduledAt: '2026-12-31T09:00:00Z',
      });

      const res = await request(app.getHttpServer())
        .get(`/mobile/client/bookings/${bookingId}/join`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(403);

      expect(res.body.message).toBe('Join is only available for online bookings');
    });

    it('returns 404 for missing booking', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get(`/mobile/client/bookings/${bookingId}/join`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(404);

      expect(res.body.message).toBe('Booking not found');
    });
  });

  describe('POST /mobile/client/bookings/:id/rate', () => {
    it('returns 201 on rating', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: bookingId,
        clientId: 'client-1',
        employeeId: 'emp-1',
      });
      mockRate.execute.mockResolvedValue({ id: 'rating-1', score: 5 });

      const res = await request(app.getHttpServer())
        .post(`/mobile/client/bookings/${bookingId}/rate`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ score: 5, comment: 'Great service!' })
        .expect(201);

      expect(res.body.score).toBe(5);
    });

    it('returns 400 for score out of range', async () => {
      return request(app.getHttpServer())
        .post(`/mobile/client/bookings/${bookingId}/rate`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ score: 6 })
        .expect(400);
    });

    it('returns 403 for non-owner booking', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: bookingId,
        clientId: 'other-client',
        employeeId: 'emp-1',
      });

      const res = await request(app.getHttpServer())
        .post(`/mobile/client/bookings/${bookingId}/rate`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ score: 5 })
        .expect(403);

      expect(res.body.message).toBe('Not your booking');
    });
  });

  describe('PATCH /mobile/client/bookings/:id/reschedule', () => {
    it('returns 200 on reschedule', async () => {
      mockReschedule.execute.mockResolvedValue({ id: bookingId, status: 'RESCHEDULED' });

      const res = await request(app.getHttpServer())
        .patch(`/mobile/client/bookings/${bookingId}/reschedule`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ newScheduledAt: '2026-12-31T10:00:00.000Z' })
        .expect(200);

      expect(res.body.status).toBe('RESCHEDULED');
    });

    it('returns 400 for invalid date', async () => {
      return request(app.getHttpServer())
        .patch(`/mobile/client/bookings/${bookingId}/reschedule`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ newScheduledAt: 'tomorrow' })
        .expect(400);
    });
  });
});
