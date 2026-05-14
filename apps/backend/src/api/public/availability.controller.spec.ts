import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicAvailabilityController } from './availability.controller';
import { GetPublicAvailabilityHandler } from '../../modules/bookings/availability/public/get-public-availability.handler';

describe('PublicAvailabilityController (e2e)', () => {
  let app: INestApplication;

  const mockAvailabilityHandler = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicAvailabilityController],
      providers: [{ provide: GetPublicAvailabilityHandler, useValue: mockAvailabilityHandler }],
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
});
