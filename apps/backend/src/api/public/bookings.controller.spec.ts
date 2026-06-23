import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import {
  PublicBookingsController,
  PublicProgramsController,
} from './bookings.controller';
import { CreatePublicBookingHandler } from '../../modules/bookings/public/create-public-booking.handler';
import { GetBookingStatusHandler } from '../../modules/bookings/public/get-booking-status.handler';
import { ListPublicProgramsHandler } from '../../modules/bookings/public/list-public-programs.handler';
import { GetPublicProgramHandler } from '../../modules/bookings/public/get-public-program.handler';
import { EnrollInProgramHandler } from '../../modules/bookings/enroll-in-program/enroll-in-program.handler';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';

describe('PublicBookingsController (e2e)', () => {
  let app: INestApplication;

  const mockCreateBooking = { execute: jest.fn() };
  const mockGetBookingStatus = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicBookingsController],
      providers: [
        { provide: CreatePublicBookingHandler, useValue: mockCreateBooking },
        { provide: GetBookingStatusHandler, useValue: mockGetBookingStatus },
      ],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: 'client-1', email: 'client@example.com', phone: '+966501234567' };
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

  const validBooking = {
    serviceId: '00000000-0000-4000-a000-000000000001',
    employeeId: '00000000-0000-4000-a000-000000000002',
    branchId: '00000000-0000-4000-a000-000000000003',
    startsAt: '2026-12-31T09:00:00Z',
  };

  describe('POST /public/bookings', () => {
    it('returns 201 on a valid booking and uses the session clientId', async () => {
      mockCreateBooking.execute.mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' });

      const res = await request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-client-session')
        .send(validBooking)
        .expect(201);

      expect(res.body.id).toBe('booking-1');
      // clientId MUST come from the session, never the request body.
      expect(mockCreateBooking.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: '00000000-0000-4000-a000-000000000001',
          employeeId: '00000000-0000-4000-a000-000000000002',
          branchId: '00000000-0000-4000-a000-000000000003',
          clientId: 'client-1',
        }),
      );
      const arg = mockCreateBooking.execute.mock.calls[0][0];
      expect(arg.scheduledAt).toBeInstanceOf(Date);
    });

    it('returns 400 for missing required fields', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-client-session')
        .send({ serviceId: '00000000-0000-4000-a000-000000000001' })
        .expect(400);
    });

    it('returns 400 for invalid startsAt', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-client-session')
        .send({ ...validBooking, startsAt: 'tomorrow' })
        .expect(400);
    });

    it('rejects a clientId in the body as an unknown field', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-client-session')
        .send({ ...validBooking, clientId: '00000000-0000-4000-a000-000000000099' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-client-session')
        .send({ ...validBooking, extra: 'bad' })
        .expect(400);
    });

    it('accepts booking without branchId (defaults to main branch via handler)', async () => {
      mockCreateBooking.execute.mockResolvedValue({ id: 'booking-2', status: 'CONFIRMED' });

      const { branchId: _omitted, ...bookingWithoutBranch } = validBooking;

      const res = await request(app.getHttpServer())
        .post('/public/bookings')
        .set('Authorization', 'Bearer fake-client-session')
        .send(bookingWithoutBranch)
        .expect(201);

      expect(res.body.id).toBe('booking-2');
      // Handler receives branchId as undefined — resolution happens inside CreatePublicBookingHandler
      expect(mockCreateBooking.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-1',
          serviceId: '00000000-0000-4000-a000-000000000001',
          employeeId: '00000000-0000-4000-a000-000000000002',
        }),
      );
    });
  });
});

describe('PublicProgramsController (e2e)', () => {
  let app: INestApplication;

  const mockListPublicPrograms = { execute: jest.fn() };
  const mockGetPublicProgram = { execute: jest.fn() };
  const mockEnroll = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicProgramsController],
      providers: [
        { provide: ListPublicProgramsHandler, useValue: mockListPublicPrograms },
        { provide: GetPublicProgramHandler, useValue: mockGetPublicProgram },
        { provide: EnrollInProgramHandler, useValue: mockEnroll },
      ],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: 'client-1', email: 'client@example.com', phone: '+966501234567' };
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

  const programId = '00000000-0000-4000-a000-000000000010';

  describe('POST /public/programs/:id/enroll', () => {
    it('returns 201 on a valid enroll and uses the session clientId', async () => {
      mockEnroll.execute.mockResolvedValue({
        type: 'ENROLLED',
        bookingId: 'b-1',
        status: 'CONFIRMED',
        invoiceId: null,
      });

      const res = await request(app.getHttpServer())
        .post(`/public/programs/${programId}/enroll`)
        .set('Authorization', 'Bearer fake-client-session')
        .expect(201);

      expect(res.body).toEqual({
        type: 'ENROLLED',
        bookingId: 'b-1',
        status: 'CONFIRMED',
        invoiceId: null,
      });

      // SECURITY: clientId comes from the verified session, never the body.
      // `public: true` tells the handler the call came from the public endpoint.
      expect(mockEnroll.execute).toHaveBeenCalledTimes(1);
      expect(mockEnroll.execute).toHaveBeenCalledWith({
        programId,
        clientId: 'client-1',
        public: true,
      });
    });

    it('returns 400 when :id is not a UUID and never invokes the handler', async () => {
      await request(app.getHttpServer())
        .post('/public/programs/not-a-uuid/enroll')
        .set('Authorization', 'Bearer fake-client-session')
        .expect(400);

      expect(mockEnroll.execute).not.toHaveBeenCalled();
    });

    it('propagates a 409 ConflictException from the handler', async () => {
      mockEnroll.execute.mockRejectedValue(
        new ConflictException('Program full or already enrolled'),
      );

      await request(app.getHttpServer())
        .post(`/public/programs/${programId}/enroll`)
        .set('Authorization', 'Bearer fake-client-session')
        .expect(409);

      expect(mockEnroll.execute).toHaveBeenCalledTimes(1);
    });

    it('propagates a 404 NotFoundException from the handler', async () => {
      mockEnroll.execute.mockRejectedValue(
        new NotFoundException('Program not found'),
      );

      await request(app.getHttpServer())
        .post(`/public/programs/${programId}/enroll`)
        .set('Authorization', 'Bearer fake-client-session')
        .expect(404);

      expect(mockEnroll.execute).toHaveBeenCalledTimes(1);
    });
  });
});
