import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicAvailabilityController } from './availability.controller';
import { GetPublicAvailabilityHandler } from '../../modules/bookings/availability/public/get-public-availability.handler';
import { GetPublicAvailabilityDaysHandler } from '../../modules/bookings/availability/public/get-public-availability-days.handler';

describe('PublicAvailabilityController (e2e)', () => {
  let app: INestApplication;

  const mockAvailabilityHandler = { execute: jest.fn() };
  const mockDaysHandler = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicAvailabilityController],
      providers: [
        { provide: GetPublicAvailabilityHandler, useValue: mockAvailabilityHandler },
        { provide: GetPublicAvailabilityDaysHandler, useValue: mockDaysHandler },
      ],
    }).compile();

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

  const uuid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;

  describe('GET /public/employees/:id/availability', () => {
    it('returns 200 with availability slots', async () => {
      mockAvailabilityHandler.execute.mockResolvedValue([
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '09:30', endTime: '10:00' },
      ]);

      const res = await request(app.getHttpServer())
        .get(`/public/employees/${uuid(1)}/availability?date=2026-05-20`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(mockAvailabilityHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: uuid(1), date: '2026-05-20' }),
      );
    });

    it('returns 400 when date is missing', async () => {
      return request(app.getHttpServer())
        .get(`/public/employees/${uuid(1)}/availability`)
        .expect(400);
    });

    it('returns 400 when date is invalid', async () => {
      return request(app.getHttpServer())
        .get(`/public/employees/${uuid(1)}/availability?date=tomorrow`)
        .expect(400);
    });

    it('returns 400 for unknown query fields', async () => {
      return request(app.getHttpServer())
        .get(`/public/employees/${uuid(1)}/availability?date=2026-05-20&extra=bad`)
        .expect(400);
    });
  });

  describe('GET /public/employees/:id/availability/days', () => {
    it('returns 200 with the days availability map', async () => {
      mockDaysHandler.execute.mockResolvedValue({
        '2026-05-20': true,
        '2026-05-21': false,
      });

      await request(app.getHttpServer())
        .get(`/public/employees/${uuid(1)}/availability/days`)
        .expect(200);

      expect(mockDaysHandler.execute).toHaveBeenCalledWith({
        employeeId: uuid(1),
        serviceId: undefined,
        branchId: undefined,
        startDate: undefined,
        days: undefined,
      });
    });

    it('parses days query parameter to a number (parseInt branch)', async () => {
      mockDaysHandler.execute.mockResolvedValue({});

      await request(app.getHttpServer())
        .get(`/public/employees/${uuid(1)}/availability/days?days=14`)
        .expect(200);

      expect(mockDaysHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ days: 14 }),
      );
    });

    it('forwards serviceId, branchId, and startDate query parameters', async () => {
      mockDaysHandler.execute.mockResolvedValue({});

      await request(app.getHttpServer())
        .get(
          `/public/employees/${uuid(1)}/availability/days?serviceId=${uuid(2)}&branchId=${uuid(3)}&startDate=2026-05-20&days=7`,
        )
        .expect(200);

      expect(mockDaysHandler.execute).toHaveBeenCalledWith({
        employeeId: uuid(1),
        serviceId: uuid(2),
        branchId: uuid(3),
        startDate: '2026-05-20',
        days: 7,
      });
    });

    it('passes days=undefined when the query param is absent (optional branch)', async () => {
      mockDaysHandler.execute.mockResolvedValue({});

      await request(app.getHttpServer())
        .get(`/public/employees/${uuid(1)}/availability/days?startDate=2026-05-20`)
        .expect(200);

      expect(mockDaysHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ days: undefined }),
      );
    });

    it('forwards durationOptionId, durationMins, deliveryType, and bookingType query parameters', async () => {
      mockDaysHandler.execute.mockResolvedValue({});

      await request(app.getHttpServer())
        .get(
          `/public/employees/${uuid(1)}/availability/days?serviceId=${uuid(2)}&branchId=${uuid(3)}&startDate=2026-05-20&days=7&durationOptionId=${uuid(4)}&durationMins=45&deliveryType=ONLINE&bookingType=INDIVIDUAL`,
        )
        .expect(200);

      expect(mockDaysHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: uuid(2),
          branchId: uuid(3),
          startDate: '2026-05-20',
          days: 7,
          durationOptionId: uuid(4),
          durationMins: 45,
          deliveryType: 'ONLINE',
          bookingType: 'INDIVIDUAL',
        }),
      );
    });

    it('omits the new context fields when no context query params are sent', async () => {
      mockDaysHandler.execute.mockResolvedValue({});

      await request(app.getHttpServer())
        .get(`/public/employees/${uuid(1)}/availability/days?days=14`)
        .expect(200);

      expect(mockDaysHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          durationOptionId: undefined,
          durationMins: undefined,
          deliveryType: undefined,
          bookingType: undefined,
        }),
      );
    });

    it('rejects a non-numeric durationMins with 400 (never forwards NaN)', async () => {
      await request(app.getHttpServer())
        .get(`/public/employees/${uuid(1)}/availability/days?durationMins=abc`)
        .expect(400);

      expect(mockDaysHandler.execute).not.toHaveBeenCalled();
    });

    it('rejects a non-integer durationMins with 400', async () => {
      await request(app.getHttpServer())
        .get(`/public/employees/${uuid(1)}/availability/days?durationMins=45.5`)
        .expect(400);

      expect(mockDaysHandler.execute).not.toHaveBeenCalled();
    });

    it('rejects a deliveryType outside the Prisma enum with 400', async () => {
      await request(app.getHttpServer())
        .get(`/public/employees/${uuid(1)}/availability/days?deliveryType=TELEPORT`)
        .expect(400);

      expect(mockDaysHandler.execute).not.toHaveBeenCalled();
    });

    it('rejects a non-UUID durationOptionId with 400', async () => {
      await request(app.getHttpServer())
        .get(`/public/employees/${uuid(1)}/availability/days?durationOptionId=not-a-uuid`)
        .expect(400);

      expect(mockDaysHandler.execute).not.toHaveBeenCalled();
    });
  });
});
