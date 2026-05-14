import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicSlotsController } from './slots.controller';
import { CheckAvailabilityHandler } from '../../modules/bookings/check-availability/check-availability.handler';

describe('PublicSlotsController (e2e)', () => {
  let app: INestApplication;

  const mockCheckAvailability = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicSlotsController],
      providers: [
        { provide: CheckAvailabilityHandler, useValue: mockCheckAvailability },
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

  describe('GET /public/availability', () => {
    it('returns 200 with available slots', async () => {
      mockCheckAvailability.execute.mockResolvedValue([
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '09:30', endTime: '10:00' },
      ]);

      const res = await request(app.getHttpServer())
        .get('/public/availability')
        .query({
          employeeId: '00000000-0000-4000-a000-000000000001',
          branchId: '00000000-0000-4000-a000-000000000002',
          date: '2026-05-20',
        })
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(mockCheckAvailability.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: '00000000-0000-4000-a000-000000000001',
          branchId: '00000000-0000-4000-a000-000000000002',
          date: expect.any(Date),
        }),
      );
    });

    it('returns 400 for missing required fields', async () => {
      return request(app.getHttpServer())
        .get('/public/availability')
        .query({ employeeId: '00000000-0000-4000-a000-000000000001' })
        .expect(400);
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/public/availability')
        .query({
          employeeId: 'not-a-uuid',
          branchId: '00000000-0000-4000-a000-000000000002',
          date: '2026-05-20',
        })
        .expect(400);
    });

    it('returns 400 for invalid date', async () => {
      return request(app.getHttpServer())
        .get('/public/availability')
        .query({
          employeeId: '00000000-0000-4000-a000-000000000001',
          branchId: '00000000-0000-4000-a000-000000000002',
          date: 'tomorrow',
        })
        .expect(400);
    });

    it('passes optional query params to handler', async () => {
      mockCheckAvailability.execute.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/public/availability?employeeId=00000000-0000-4000-a000-000000000001&branchId=00000000-0000-4000-a000-000000000002&date=2026-05-20&durationMins=45&serviceId=00000000-0000-4000-a000-000000000003&durationOptionId=00000000-0000-4000-a000-000000000004&bookingType=INDIVIDUAL')
        .expect(200);

      expect(mockCheckAvailability.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMins: 45,
          serviceId: '00000000-0000-4000-a000-000000000003',
          durationOptionId: '00000000-0000-4000-a000-000000000004',
          bookingType: 'INDIVIDUAL',
        }),
      );
    });
  });
});
