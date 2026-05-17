import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardOrganizationSettingsController } from './organization-settings.controller';
import { CreateServiceHandler } from '../../modules/org-experience/services/create-service.handler';
import { UpdateServiceHandler } from '../../modules/org-experience/services/update-service.handler';
import { ListServicesHandler } from '../../modules/org-experience/services/list-services.handler';
import { GetServiceHandler } from '../../modules/org-experience/services/get-service.handler';
import { ArchiveServiceHandler } from '../../modules/org-experience/services/archive-service.handler';
import { SetDurationOptionsHandler } from '../../modules/org-experience/services/set-duration-options.handler';
import { SetServiceBookingConfigsHandler } from '../../modules/org-experience/services/set-service-booking-configs.handler';
import { GetServiceBookingConfigsHandler } from '../../modules/org-experience/services/get-service-booking-configs.handler';
import { ListServiceEmployeesHandler } from '../../modules/org-experience/services/list-service-employees.handler';
import { UpsertBrandingHandler } from '../../modules/org-experience/branding/upsert-branding.handler';
import { GetBrandingHandler } from '../../modules/org-experience/branding/get-branding.handler';
import { UploadLogoHandler } from '../../modules/org-experience/branding/upload-logo/upload-logo.handler';
import { CreateIntakeFormHandler } from '../../modules/org-experience/intake-forms/create-intake-form.handler';
import { GetIntakeFormHandler } from '../../modules/org-experience/intake-forms/get-intake-form.handler';
import { ListIntakeFormsHandler } from '../../modules/org-experience/intake-forms/list-intake-forms.handler';
import { DeleteIntakeFormHandler } from '../../modules/org-experience/intake-forms/delete-intake-form.handler';
import { SubmitRatingHandler } from '../../modules/org-experience/ratings/submit-rating.handler';
import { ListRatingsHandler } from '../../modules/org-experience/ratings/list-ratings.handler';
import { GetOrgSettingsHandler } from '../../modules/org-experience/org-settings/get-org-settings.handler';
import { UpsertOrgSettingsHandler } from '../../modules/org-experience/org-settings/upsert-org-settings.handler';
import { GetBookingSettingsHandler } from '../../modules/bookings/get-booking-settings/get-booking-settings.handler';
import { UpsertBookingSettingsHandler } from '../../modules/bookings/upsert-booking-settings/upsert-booking-settings.handler';
import { CreateBundleHandler } from '../../modules/org-experience/bundles/create-bundle.handler';
import { UpdateBundleHandler } from '../../modules/org-experience/bundles/update-bundle.handler';
import { ListBundlesHandler } from '../../modules/org-experience/bundles/list-bundles.handler';
import { GetBundleHandler } from '../../modules/org-experience/bundles/get-bundle.handler';
import { ArchiveBundleHandler } from '../../modules/org-experience/bundles/archive-bundle.handler';
import { PrismaService } from '../../infrastructure/database';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardOrganizationSettingsController (e2e)', () => {
  let app: INestApplication;

  const mockCreateService = { execute: jest.fn() };
  const mockUpdateService = { execute: jest.fn() };
  const mockListServices = { execute: jest.fn() };
  const mockGetService = { execute: jest.fn() };
  const mockArchiveService = { execute: jest.fn() };
  const mockSetServiceBookingConfigs = { execute: jest.fn() };
  const mockGetServiceBookingConfigs = { execute: jest.fn() };
  const mockListServiceEmployees = { execute: jest.fn() };
  const mockUpsertBranding = { execute: jest.fn() };
  const mockGetBranding = { execute: jest.fn() };
  const mockUploadLogo = { execute: jest.fn() };
  const mockCreateIntakeForm = { execute: jest.fn() };
  const mockGetIntakeForm = { execute: jest.fn() };
  const mockListIntakeForms = { execute: jest.fn() };
  const mockDeleteIntakeForm = { execute: jest.fn() };
  const mockSubmitRating = { execute: jest.fn() };
  const mockListRatings = { execute: jest.fn() };
  const mockGetOrgSettings = { execute: jest.fn() };
  const mockUpsertOrgSettings = { execute: jest.fn() };
  const mockGetBookingSettings = { execute: jest.fn() };
  const mockUpsertBookingSettings = { execute: jest.fn() };
  const mockSetDurationOptions = { execute: jest.fn() };
  const mockCreateBundle = { execute: jest.fn() };
  const mockUpdateBundle = { execute: jest.fn() };
  const mockListBundles = { execute: jest.fn() };
  const mockGetBundle = { execute: jest.fn() };
  const mockArchiveBundle = { execute: jest.fn() };
  const mockPrisma = { serviceDurationOption: { findMany: jest.fn() } };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardOrganizationSettingsController],
      providers: [
        { provide: CreateServiceHandler, useValue: mockCreateService },
        { provide: UpdateServiceHandler, useValue: mockUpdateService },
        { provide: ListServicesHandler, useValue: mockListServices },
        { provide: GetServiceHandler, useValue: mockGetService },
        { provide: ArchiveServiceHandler, useValue: mockArchiveService },
        { provide: SetServiceBookingConfigsHandler, useValue: mockSetServiceBookingConfigs },
        { provide: GetServiceBookingConfigsHandler, useValue: mockGetServiceBookingConfigs },
        { provide: ListServiceEmployeesHandler, useValue: mockListServiceEmployees },
        { provide: UpsertBrandingHandler, useValue: mockUpsertBranding },
        { provide: GetBrandingHandler, useValue: mockGetBranding },
        { provide: UploadLogoHandler, useValue: mockUploadLogo },
        { provide: CreateIntakeFormHandler, useValue: mockCreateIntakeForm },
        { provide: GetIntakeFormHandler, useValue: mockGetIntakeForm },
        { provide: ListIntakeFormsHandler, useValue: mockListIntakeForms },
        { provide: DeleteIntakeFormHandler, useValue: mockDeleteIntakeForm },
        { provide: SubmitRatingHandler, useValue: mockSubmitRating },
        { provide: ListRatingsHandler, useValue: mockListRatings },
        { provide: GetOrgSettingsHandler, useValue: mockGetOrgSettings },
        { provide: UpsertOrgSettingsHandler, useValue: mockUpsertOrgSettings },
        { provide: GetBookingSettingsHandler, useValue: mockGetBookingSettings },
        { provide: UpsertBookingSettingsHandler, useValue: mockUpsertBookingSettings },
        { provide: SetDurationOptionsHandler, useValue: mockSetDurationOptions },
        { provide: CreateBundleHandler, useValue: mockCreateBundle },
        { provide: UpdateBundleHandler, useValue: mockUpdateBundle },
        { provide: ListBundlesHandler, useValue: mockListBundles },
        { provide: GetBundleHandler, useValue: mockGetBundle },
        { provide: ArchiveBundleHandler, useValue: mockArchiveBundle },
        { provide: PrismaService, useValue: mockPrisma },
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

  const uuid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;

  // ── Services ─────────────────────────────────────────────────────────────

  describe('POST /dashboard/organization/services', () => {
    it('returns 201 on valid service creation', async () => {
      mockCreateService.execute.mockResolvedValue({ id: uuid(1), nameAr: 'قص الشعر' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/organization/services')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'قص الشعر', durationMins: 30, price: 50 })
        .expect(201);

      expect(res.body.nameAr).toBe('قص الشعر');
    });

    it('returns 400 for missing required fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/services')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'قص الشعر' })
        .expect(400);
    });

    it('returns 400 for negative price', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/services')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'قص الشعر', durationMins: 30, price: -10 })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/services')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'قص الشعر', durationMins: 30, price: 50, extra: 'bad' })
        .expect(400);
    });
  });

  describe('GET /dashboard/organization/services', () => {
    it('returns 200 with service list', async () => {
      mockListServices.execute.mockResolvedValue({ data: [{ id: uuid(1), nameAr: 'قص الشعر' }], total: 1 });

      const res = await request(app.getHttpServer())
        .get('/dashboard/organization/services')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /dashboard/organization/services/:serviceId', () => {
    it('returns 200 with service details', async () => {
      mockGetService.execute.mockResolvedValue({ id: uuid(1), nameAr: 'قص الشعر' });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/organization/services/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.nameAr).toBe('قص الشعر');
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/organization/services/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('PATCH /dashboard/organization/services/:serviceId', () => {
    it('returns 200 on valid update', async () => {
      mockUpdateService.execute.mockResolvedValue({ id: uuid(1), nameAr: 'قص وصبغ' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/organization/services/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ price: 75 })
        .expect(200);

      expect(res.body.nameAr).toBe('قص وصبغ');
    });
  });

  describe('DELETE /dashboard/organization/services/:serviceId', () => {
    it('returns 204 on archive', async () => {
      mockArchiveService.execute.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete(`/dashboard/organization/services/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);
    });
  });

  describe('GET /dashboard/organization/services/:serviceId/employees', () => {
    it('returns 200 with employees list', async () => {
      mockListServiceEmployees.execute.mockResolvedValue([{ id: uuid(2), name: 'Khalid' }]);

      const res = await request(app.getHttpServer())
        .get(`/dashboard/organization/services/${uuid(1)}/employees`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(1);
    });
  });

  // ── Organization Settings ─────────────────────────────────────────────────

  describe('GET /dashboard/organization/settings', () => {
    it('returns 200 with org settings', async () => {
      mockGetOrgSettings.execute.mockResolvedValue({ name: 'My Clinic', timezone: 'Asia/Riyadh' });

      const res = await request(app.getHttpServer())
        .get('/dashboard/organization/settings')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.name).toBe('My Clinic');
    });
  });

  describe('GET /dashboard/organization/booking-settings', () => {
    it('returns 200 with booking settings', async () => {
      mockGetBookingSettings.execute.mockResolvedValue({ maxAdvanceBookingDays: 30 });

      const res = await request(app.getHttpServer())
        .get('/dashboard/organization/booking-settings')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.maxAdvanceBookingDays).toBe(30);
    });
  });
});
