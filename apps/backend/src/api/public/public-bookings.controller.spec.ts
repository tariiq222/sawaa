import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicBookingsController } from './bookings.controller';
import { CreateGuestBookingHandler } from '../../modules/bookings/public/create-guest-booking.handler';
import { ListPublicGroupSessionsHandler } from '../../modules/bookings/public/list-public-group-sessions.handler';
import { GetPublicGroupSessionHandler } from '../../modules/bookings/public/get-public-group-session.handler';
import { BookGroupSessionHandler } from '../../modules/bookings/public/book-group-session.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { OtpSessionGuard } from '../../modules/identity/otp/otp-session.guard';

describe('PublicBookingsController (e2e)', () => {
  let app: INestApplication;

  const mockCreateGuestBooking = { execute: jest.fn() };
  const mockListGroupSessions = { execute: jest.fn() };
  const mockGetGroupSession = { execute: jest.fn() };
  const mockBookGroupSession = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicBookingsController],
      providers: [
        { provide: CreateGuestBookingHandler, useValue: mockCreateGuestBooking },
        { provide: ListPublicGroupSessionsHandler, useValue: mockListGroupSessions },
        { provide: GetPublicGroupSessionHandler, useValue: mockGetGroupSession },
        { provide: BookGroupSessionHandler, useValue: mockBookGroupSession },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: 'client-1', email: 'test@example.com', phone: '+966501234567' };
          return true;
        },
      })
      .overrideGuard(OtpSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.otpSession = {
            identifier: 'test@example.com',
            jti: 'jti-abc',
            exp: Math.floor(Date.now() / 1000) + 1800,
            channel: 'EMAIL',
            purpose: 'GUEST_BOOKING',
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /public/bookings/group-sessions', () => {
    it('returns 200 with list of group sessions', async () => {
      mockListGroupSessions.execute.mockResolvedValue([
        { id: 'gs-1', name: 'Yoga Class', slotsAvailable: 5 },
      ]);

      return request(app.getHttpServer())
        .get('/public/bookings/group-sessions')
        .expect(200)
        .expect(({ body }) => {
          expect(body).toHaveLength(1);
          expect(body[0].id).toBe('gs-1');
        });
    });

    it('passes branchId query parameter to handler', async () => {
      mockListGroupSessions.execute.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/public/bookings/group-sessions?branchId=branch-1')
        .expect(200);

      expect(mockListGroupSessions.execute).toHaveBeenCalledWith('branch-1');
    });
  });

  describe('GET /public/bookings/group-sessions/:id', () => {
    it('returns 200 with group session details', async () => {
      mockGetGroupSession.execute.mockResolvedValue({
        id: 'gs-1',
        name: 'Yoga Class',
        maxParticipants: 10,
      });

      return request(app.getHttpServer())
        .get('/public/bookings/group-sessions/00000000-0000-0000-0000-000000000001')
        .expect(200)
        .expect(({ body }) => {
          expect(body.id).toBe('gs-1');
        });
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/public/bookings/group-sessions/not-a-uuid')
        .expect(400);
    });
  });

  describe('POST /public/bookings/group-sessions/:id/book', () => {
    it('returns 201 when booking succeeds', async () => {
      mockBookGroupSession.execute.mockResolvedValue({
        type: 'BOOKED',
        bookingId: 'booking-1',
        waitlistPosition: null,
      });

      return request(app.getHttpServer())
        .post('/public/bookings/group-sessions/00000000-0000-0000-0000-000000000001/book')
        .set('Authorization', 'Bearer fake-token')
        .expect(201)
        .expect(({ body }) => {
          expect(body.type).toBe('BOOKED');
          expect(body.bookingId).toBe('booking-1');
        });
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings/group-sessions/not-a-uuid/book')
        .set('Authorization', 'Bearer fake-token')
        .expect(400);
    });
  });

  describe('POST /public/bookings (guest booking)', () => {
    const validDto = {
      serviceId: '11111111-1111-4111-a111-111111111111',
      employeeId: '22222222-2222-4222-a222-222222222222',
      branchId: '33333333-3333-4333-a333-333333333333',
      startsAt: '2026-12-31T09:00:00Z',
      client: {
        name: 'Test User',
        phone: '+966501234567',
        email: 'test@example.com',
        gender: 'MALE',
      },
    };

    it('returns 201 with booking result on valid payload', async () => {
      mockCreateGuestBooking.execute.mockResolvedValue({
        bookingId: 'booking-1',
        invoiceId: 'invoice-1',
        totalHalalat: 11500,
      });

      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-otp-token')
        .send(validDto)
        .expect(201)
        .expect(({ body }) => {
          expect(body.bookingId).toBe('booking-1');
          expect(body.invoiceId).toBe('invoice-1');
        });
    });

    it('returns 400 when serviceId is not UUID', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-otp-token')
        .send({ ...validDto, serviceId: 'not-a-uuid' })
        .expect(400);
    });

    it('returns 400 when startsAt is not ISO date', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-otp-token')
        .send({ ...validDto, startsAt: 'tomorrow' })
        .expect(400);
    });

    it('returns 400 when client email is invalid', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-otp-token')
        .send({
          ...validDto,
          client: { ...validDto.client, email: 'not-an-email' },
        })
        .expect(400);
    });

    it('returns 400 when client name is empty', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-otp-token')
        .send({
          ...validDto,
          client: { ...validDto.client, name: '' },
        })
        .expect(400);
    });

    it('returns 400 for unknown fields (whitelist)', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-otp-token')
        .send({ ...validDto, extraField: 'bad' })
        .expect(400);
    });

    it('returns 401 without OTP session token', async () => {
      // Override OtpSessionGuard to reject
      const moduleRef: TestingModule = await Test.createTestingModule({
        controllers: [PublicBookingsController],
        providers: [
          { provide: CreateGuestBookingHandler, useValue: mockCreateGuestBooking },
          { provide: ListPublicGroupSessionsHandler, useValue: mockListGroupSessions },
          { provide: GetPublicGroupSessionHandler, useValue: mockGetGroupSession },
          { provide: BookGroupSessionHandler, useValue: mockBookGroupSession },
        ],
      })
        .overrideGuard(JwtGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(ClientSessionGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(OtpSessionGuard)
        .useValue({ canActivate: () => false })
        .compile();

      const guardedApp = moduleRef.createNestApplication();
      guardedApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
      await guardedApp.init();

      await request(guardedApp.getHttpServer())
        .post('/public/bookings')
        .send(validDto)
        .expect(403);

      await guardedApp.close();
    });
  });
});
