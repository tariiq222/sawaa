import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardOrganizationHoursController } from './organization-hours.controller';
import { SetBusinessHoursHandler } from '../../modules/org-config/business-hours/set-business-hours.handler';
import { GetBusinessHoursHandler } from '../../modules/org-config/business-hours/get-business-hours.handler';
import { AddHolidayHandler } from '../../modules/org-config/business-hours/add-holiday.handler';
import { RemoveHolidayHandler } from '../../modules/org-config/business-hours/remove-holiday.handler';
import { ListHolidaysHandler } from '../../modules/org-config/business-hours/list-holidays.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardOrganizationHoursController (e2e)', () => {
  let app: INestApplication;

  const mockSetHours = { execute: jest.fn() };
  const mockGetHours = { execute: jest.fn() };
  const mockAddHoliday = { execute: jest.fn() };
  const mockRemoveHoliday = { execute: jest.fn() };
  const mockListHolidays = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardOrganizationHoursController],
      providers: [
        { provide: SetBusinessHoursHandler, useValue: mockSetHours },
        { provide: GetBusinessHoursHandler, useValue: mockGetHours },
        { provide: AddHolidayHandler, useValue: mockAddHoliday },
        { provide: RemoveHolidayHandler, useValue: mockRemoveHoliday },
        { provide: ListHolidaysHandler, useValue: mockListHolidays },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
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

  const validSchedule = [
    { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOpen: true },
    { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isOpen: true },
  ];

  describe('POST /dashboard/organization/hours', () => {
    it('returns 201 on valid set business hours', async () => {
      mockSetHours.execute.mockResolvedValue({ branchId: 'branch-1', schedule: validSchedule });

      const res = await request(app.getHttpServer())
        .post('/dashboard/organization/hours')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ branchId: 'branch-1', schedule: validSchedule })
        .expect(201);

      expect(res.body.branchId).toBe('branch-1');
    });

    it('returns 400 for missing branchId', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/hours')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ schedule: validSchedule })
        .expect(400);
    });

    it('returns 400 for empty schedule', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/hours')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ branchId: 'branch-1', schedule: [] })
        .expect(400);
    });

    it('returns 400 for invalid time format', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/hours')
        .set('Authorization', 'Bearer fake-jwt')
        .send({
          branchId: 'branch-1',
          schedule: [{ dayOfWeek: 0, startTime: '9:00', endTime: '17:00', isOpen: true }],
        })
        .expect(400);
    });

    it('returns 400 for invalid dayOfWeek', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/hours')
        .set('Authorization', 'Bearer fake-jwt')
        .send({
          branchId: 'branch-1',
          schedule: [{ dayOfWeek: 7, startTime: '09:00', endTime: '17:00', isOpen: true }],
        })
        .expect(400);
    });
  });

  describe('GET /dashboard/organization/hours/:branchId', () => {
    it('returns 200 with business hours', async () => {
      mockGetHours.execute.mockResolvedValue({ branchId: 'branch-1', schedule: validSchedule });

      const res = await request(app.getHttpServer())
        .get('/dashboard/organization/hours/branch-1')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.branchId).toBe('branch-1');
      expect(mockGetHours.execute).toHaveBeenCalledWith({ branchId: 'branch-1' });
    });
  });

  describe('POST /dashboard/organization/holidays', () => {
    it('returns 201 on valid add holiday', async () => {
      mockAddHoliday.execute.mockResolvedValue({ id: 'hol-1', branchId: 'branch-1', date: '2025-12-31', nameAr: 'اليوم الوطني' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/organization/holidays')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ branchId: 'branch-1', date: '2025-12-31', nameAr: 'اليوم الوطني' })
        .expect(201);

      expect(res.body.nameAr).toBe('اليوم الوطني');
    });

    it('returns 400 for invalid date', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/holidays')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ branchId: 'branch-1', date: 'not-a-date', nameAr: 'Test' })
        .expect(400);
    });

    it('returns 400 for missing nameAr', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/holidays')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ branchId: 'branch-1', date: '2025-12-31' })
        .expect(400);
    });
  });

  describe('DELETE /dashboard/organization/holidays/:holidayId', () => {
    it('returns 204 on remove holiday', async () => {
      mockRemoveHoliday.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/dashboard/organization/holidays/00000000-0000-4000-a000-000000000001')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);

      expect(mockRemoveHoliday.execute).toHaveBeenCalledWith({
        holidayId: '00000000-0000-4000-a000-000000000001',
      });
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .delete('/dashboard/organization/holidays/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('GET /dashboard/organization/holidays', () => {
    it('returns 200 with holiday list', async () => {
      mockListHolidays.execute.mockResolvedValue([
        { id: 'hol-1', date: '2025-12-31', nameAr: 'اليوم الوطني' },
      ]);

      const res = await request(app.getHttpServer())
        .get('/dashboard/organization/holidays?branchId=branch-1&year=2025')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(mockListHolidays.execute).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'branch-1', year: 2025 }),
      );
    });

    it('returns 400 for missing branchId', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/organization/holidays')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });
});
