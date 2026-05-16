import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicBookingsController } from './bookings.controller';
import { CreateGuestBookingHandler } from '../../modules/bookings/public/create-guest-booking.handler';
import { ListPublicGroupSessionsHandler } from '../../modules/bookings/public/list-public-group-sessions.handler';
import { GetPublicGroupSessionHandler } from '../../modules/bookings/public/get-public-group-session.handler';
import { BookGroupSessionHandler } from '../../modules/bookings/public/book-group-session.handler';
import { GetBookingStatusHandler } from '../../modules/bookings/public/get-booking-status.handler';
import { OtpSessionGuard } from '../../modules/identity/otp/otp-session.guard';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';

describe('PublicBookingsController (e2e)', () => {
  let app: INestApplication;

  const mockCreateGuest = { execute: jest.fn() };
  const mockListGroup = { execute: jest.fn() };
  const mockGetGroup = { execute: jest.fn() };
  const mockBookGroup = { execute: jest.fn() };
  const mockGetBookingStatus = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicBookingsController],
      providers: [
        { provide: CreateGuestBookingHandler, useValue: mockCreateGuest },
        { provide: ListPublicGroupSessionsHandler, useValue: mockListGroup },
        { provide: GetPublicGroupSessionHandler, useValue: mockGetGroup },
        { provide: BookGroupSessionHandler, useValue: mockBookGroup },
        { provide: GetBookingStatusHandler, useValue: mockGetBookingStatus },
      ],
    })
      .overrideGuard(OtpSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.otpSession = {
            identifier: '+966501234567',
            jti: 'otp-jti-1',
            exp: Math.floor(Date.now() / 1000) + 1800,
            channel: 'SMS',
            purpose: 'GUEST_BOOKING',
          };
          return true;
        },
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

  const validGuestBooking = {
    serviceId: '00000000-0000-4000-a000-000000000001',
    employeeId: '00000000-0000-4000-a000-000000000002',
    branchId: '00000000-0000-4000-a000-000000000003',
    startsAt: '2026-12-31T09:00:00Z',
    client: {
      name: 'أحمد محمد',
      phone: '+966501234567',
      email: 'client@example.com',
    },
  };

  describe('GET /public/bookings/group-sessions', () => {
    it('returns 200 with group sessions', async () => {
      mockListGroup.execute.mockResolvedValue([{ id: 'gs-1', title: 'Yoga' }]);

      const res = await request(app.getHttpServer())
        .get('/public/bookings/group-sessions')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(mockListGroup.execute).toHaveBeenCalledWith(undefined);
    });

    it('passes branchId filter', async () => {
      mockListGroup.execute.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/public/bookings/group-sessions?branchId=00000000-0000-4000-a000-000000000003')
        .expect(200);

      expect(mockListGroup.execute).toHaveBeenCalledWith('00000000-0000-4000-a000-000000000003');
    });
  });

  describe('GET /public/bookings/group-sessions/:id', () => {
    it('returns 200 with session details', async () => {
      mockGetGroup.execute.mockResolvedValue({ id: 'gs-1', title: 'Yoga', capacity: 10 });

      const res = await request(app.getHttpServer())
        .get('/public/bookings/group-sessions/00000000-0000-4000-a000-000000000001')
        .expect(200);

      expect(res.body.title).toBe('Yoga');
      expect(mockGetGroup.execute).toHaveBeenCalledWith('00000000-0000-4000-a000-000000000001');
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/public/bookings/group-sessions/not-a-uuid')
        .expect(400);
    });
  });

  describe('POST /public/bookings/group-sessions/:id/book', () => {
    it('returns 201 on successful booking', async () => {
      mockBookGroup.execute.mockResolvedValue({ type: 'BOOKED', bookingId: 'b-1' });

      const res = await request(app.getHttpServer())
        .post('/public/bookings/group-sessions/00000000-0000-4000-a000-000000000001/book')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(201);

      expect(res.body.type).toBe('BOOKED');
      expect(mockBookGroup.execute).toHaveBeenCalledWith({
        groupSessionId: '00000000-0000-4000-a000-000000000001',
        clientId: 'client-1',
      });
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings/group-sessions/not-a-uuid/book')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('POST /public/bookings', () => {
    it('returns 201 on valid guest booking', async () => {
      mockCreateGuest.execute.mockResolvedValue({ id: 'booking-1', status: 'PENDING' });

      const res = await request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-otp-session')
        .send(validGuestBooking)
        .expect(201);

      expect(res.body.id).toBe('booking-1');
      expect(mockCreateGuest.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: '00000000-0000-4000-a000-000000000001',
          identifier: '+966501234567',
          sessionJti: 'otp-jti-1',
          sessionChannel: 'SMS',
        }),
      );
    });

    it('returns 400 for missing required fields', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-otp-session')
        .send({ serviceId: '00000000-0000-4000-a000-000000000001' })
        .expect(400);
    });

    it('returns 400 for invalid client email', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-otp-session')
        .send({
          ...validGuestBooking,
          client: { ...validGuestBooking.client, email: 'not-an-email' },
        })
        .expect(400);
    });

    it('returns 400 for invalid startsAt', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-otp-session')
        .send({ ...validGuestBooking, startsAt: 'tomorrow' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-otp-session')
        .send({ ...validGuestBooking, extra: 'bad' })
        .expect(400);
    });
  });
});
