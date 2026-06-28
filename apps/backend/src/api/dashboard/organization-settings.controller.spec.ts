import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardOrganizationSettingsController } from './organization-settings.controller';
import { CreateServiceHandler } from '../../modules/org-experience/services/create-service.handler';
import { UpdateServiceHandler } from '../../modules/org-experience/services/update-service.handler';
import { ListServicesHandler } from '../../modules/org-experience/services/list-services.handler';
import { GetServiceHandler } from '../../modules/org-experience/services/get-service.handler';
import { ArchiveServiceHandler } from '../../modules/org-experience/services/archive-service.handler';
import { RestoreServiceHandler } from '../../modules/org-experience/services/restore-service.handler';
import { GetDurationOptionsHandler } from '../../modules/org-experience/services/get-duration-options.handler';
import { SetDurationOptionsHandler } from '../../modules/org-experience/services/set-duration-options.handler';
import { SetServiceBookingConfigsHandler } from '../../modules/org-experience/services/set-service-booking-configs.handler';
import { GetServiceBookingConfigsHandler } from '../../modules/org-experience/services/get-service-booking-configs.handler';
import { ListServiceEmployeesHandler } from '../../modules/org-experience/services/list-service-employees.handler';
import { CreateIntakeFormHandler } from '../../modules/org-experience/intake-forms/create-intake-form.handler';
import { GetIntakeFormHandler } from '../../modules/org-experience/intake-forms/get-intake-form.handler';
import { ListIntakeFormsHandler } from '../../modules/org-experience/intake-forms/list-intake-forms.handler';
import { DeleteIntakeFormHandler } from '../../modules/org-experience/intake-forms/delete-intake-form.handler';
import { UpdateIntakeFormHandler } from '../../modules/org-experience/intake-forms/update-intake-form.handler';
import { SetIntakeFieldsHandler } from '../../modules/org-experience/intake-forms/set-intake-fields.handler';
import { GetIntakeFormResponsesHandler } from '../../modules/org-experience/intake-forms/get-intake-form-responses.handler';
import { SubmitIntakeResponseHandler } from '../../modules/org-experience/submit-intake-response/submit-intake-response.handler';
import { SubmitRatingHandler } from '../../modules/org-experience/ratings/submit-rating.handler';
import { ListRatingsHandler } from '../../modules/org-experience/ratings/list-ratings.handler';
import { UpdateRatingVisibilityHandler } from '../../modules/org-experience/ratings/update-rating-visibility.handler';
import { GetOrgSettingsHandler } from '../../modules/org-experience/org-settings/get-org-settings.handler';
import { UpsertOrgSettingsHandler } from '../../modules/org-experience/org-settings/upsert-org-settings.handler';
import { GetBookingSettingsHandler } from '../../modules/bookings/get-booking-settings/get-booking-settings.handler';
import { UpsertBookingSettingsHandler } from '../../modules/bookings/upsert-booking-settings/upsert-booking-settings.handler';
import { CreateSessionPackageHandler } from '../../modules/org-experience/session-packages/create-session-package/create-session-package.handler';
import { UpdateSessionPackageHandler } from '../../modules/org-experience/session-packages/update-session-package/update-session-package.handler';
import { ListSessionPackagesHandler } from '../../modules/org-experience/session-packages/list-session-packages/list-session-packages.handler';
import { GetSessionPackageHandler } from '../../modules/org-experience/session-packages/get-session-package/get-session-package.handler';
import { ArchiveSessionPackageHandler } from '../../modules/org-experience/session-packages/archive-session-package/archive-session-package.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardOrganizationSettingsController (e2e)', () => {
  let app: INestApplication;

  const mockCreateService = { execute: jest.fn() };
  const mockUpdateService = { execute: jest.fn() };
  const mockListServices = { execute: jest.fn() };
  const mockGetService = { execute: jest.fn() };
  const mockArchiveService = { execute: jest.fn() };
  const mockRestoreService = { execute: jest.fn() };
  const mockSetServiceBookingConfigs = { execute: jest.fn() };
  const mockGetServiceBookingConfigs = { execute: jest.fn() };
  const mockListServiceEmployees = { execute: jest.fn() };
  const mockCreateIntakeForm = { execute: jest.fn() };
  const mockGetIntakeForm = { execute: jest.fn() };
  const mockListIntakeForms = { execute: jest.fn() };
  const mockDeleteIntakeForm = { execute: jest.fn() };
  const mockUpdateIntakeForm = { execute: jest.fn() };
  const mockSetIntakeFields = { execute: jest.fn() };
  const mockGetIntakeFormResponses = { execute: jest.fn() };
  const mockSubmitRating = { execute: jest.fn() };
  const mockListRatings = { execute: jest.fn() };
  const mockUpdateRatingVisibility = { execute: jest.fn() };
  const mockGetOrgSettings = { execute: jest.fn() };
  const mockUpsertOrgSettings = { execute: jest.fn() };
  const mockGetBookingSettings = { execute: jest.fn() };
  const mockUpsertBookingSettings = { execute: jest.fn() };
  const mockGetDurationOptions = { execute: jest.fn() };
  const mockSetDurationOptions = { execute: jest.fn() };
  const mockCreateSessionPackage = { execute: jest.fn() };
  const mockUpdateSessionPackage = { execute: jest.fn() };
  const mockListSessionPackages = { execute: jest.fn() };
  const mockGetSessionPackage = { execute: jest.fn() };
  const mockArchiveSessionPackage = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardOrganizationSettingsController],
      providers: [
        { provide: CreateServiceHandler, useValue: mockCreateService },
        { provide: UpdateServiceHandler, useValue: mockUpdateService },
        { provide: ListServicesHandler, useValue: mockListServices },
        { provide: GetServiceHandler, useValue: mockGetService },
        { provide: ArchiveServiceHandler, useValue: mockArchiveService },
        { provide: RestoreServiceHandler, useValue: mockRestoreService },
        { provide: SetServiceBookingConfigsHandler, useValue: mockSetServiceBookingConfigs },
        { provide: GetServiceBookingConfigsHandler, useValue: mockGetServiceBookingConfigs },
        { provide: ListServiceEmployeesHandler, useValue: mockListServiceEmployees },
        { provide: CreateIntakeFormHandler, useValue: mockCreateIntakeForm },
        { provide: GetIntakeFormHandler, useValue: mockGetIntakeForm },
        { provide: ListIntakeFormsHandler, useValue: mockListIntakeForms },
        { provide: DeleteIntakeFormHandler, useValue: mockDeleteIntakeForm },
        { provide: UpdateIntakeFormHandler, useValue: mockUpdateIntakeForm },
        { provide: SetIntakeFieldsHandler, useValue: mockSetIntakeFields },
        { provide: GetIntakeFormResponsesHandler, useValue: mockGetIntakeFormResponses },
        { provide: SubmitIntakeResponseHandler, useValue: { execute: jest.fn() } },
        { provide: SubmitRatingHandler, useValue: mockSubmitRating },
        { provide: ListRatingsHandler, useValue: mockListRatings },
        { provide: UpdateRatingVisibilityHandler, useValue: mockUpdateRatingVisibility },
        { provide: GetOrgSettingsHandler, useValue: mockGetOrgSettings },
        { provide: UpsertOrgSettingsHandler, useValue: mockUpsertOrgSettings },
        { provide: GetBookingSettingsHandler, useValue: mockGetBookingSettings },
        { provide: UpsertBookingSettingsHandler, useValue: mockUpsertBookingSettings },
        { provide: GetDurationOptionsHandler, useValue: mockGetDurationOptions },
        { provide: SetDurationOptionsHandler, useValue: mockSetDurationOptions },
        { provide: CreateSessionPackageHandler, useValue: mockCreateSessionPackage },
        { provide: UpdateSessionPackageHandler, useValue: mockUpdateSessionPackage },
        { provide: ListSessionPackagesHandler, useValue: mockListSessionPackages },
        { provide: GetSessionPackageHandler, useValue: mockGetSessionPackage },
        { provide: ArchiveSessionPackageHandler, useValue: mockArchiveSessionPackage },
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
        .send({ nameAr: 'قص الشعر', nameEn: 'Haircut', categoryId: uuid(2), durationMins: 30, price: 50 })
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

    it('returns 400 when nameEn is missing', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/services')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'قص الشعر', categoryId: uuid(2), durationMins: 30, price: 50 })
        .expect(400);
    });

    it('returns 400 when categoryId is missing', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/services')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'قص الشعر', nameEn: 'Haircut', durationMins: 30, price: 50 })
        .expect(400);
    });

    it('returns 400 when enabling deposit without a positive amount', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/services')
        .set('Authorization', 'Bearer fake-jwt')
        .send({
          nameAr: 'قص الشعر',
          nameEn: 'Haircut',
          categoryId: uuid(2),
          durationMins: 30,
          price: 50,
          depositEnabled: true,
        })
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

    it('accepts a reference id and forwards it to the handler', async () => {
      // The route accepts a UUID or a human reference (e.g. SVC-1); the handler
      // resolves it via parseEntityRef, so the controller forwards the raw
      // identifier instead of enforcing a UUID at the route level.
      mockGetService.execute.mockResolvedValue({ id: uuid(1), nameAr: 'قص الشعر' });

      await request(app.getHttpServer())
        .get('/dashboard/organization/services/SVC-1')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockGetService.execute).toHaveBeenCalledWith({ serviceId: 'SVC-1' });
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

  describe('GET /dashboard/organization/services/:serviceId/duration-options', () => {
    it('returns 200 and forwards serviceId to the handler', async () => {
      const options = [{ id: uuid(3), serviceId: uuid(1), durationMins: 30, sortOrder: 0 }];
      mockGetDurationOptions.execute.mockResolvedValue(options);

      const res = await request(app.getHttpServer())
        .get(`/dashboard/organization/services/${uuid(1)}/duration-options`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockGetDurationOptions.execute).toHaveBeenCalledWith({ serviceId: uuid(1) });
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(uuid(3));
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/organization/services/not-a-uuid/duration-options')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
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

  // ── Ratings ───────────────────────────────────────────────────────────────

  describe('PATCH /dashboard/organization/ratings/:id/visibility', () => {
    it('returns 200 and forwards id + isPublic to the handler', async () => {
      mockUpdateRatingVisibility.execute.mockResolvedValue({ id: uuid(1), isPublic: true });

      const res = await request(app.getHttpServer())
        // The controller takes id from the path param and isPublic from the body
        // when forwarding to the handler.
        .patch(`/dashboard/organization/ratings/${uuid(1)}/visibility`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ isPublic: true })
        .expect(200);

      expect(res.body.isPublic).toBe(true);
      expect(mockUpdateRatingVisibility.execute).toHaveBeenCalledWith({
        id: uuid(1),
        isPublic: true,
      });
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .patch('/dashboard/organization/ratings/not-a-uuid/visibility')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ isPublic: true })
        .expect(400);
    });

    it('returns 400 for non-boolean isPublic', async () => {
      return request(app.getHttpServer())
        .patch(`/dashboard/organization/ratings/${uuid(1)}/visibility`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ isPublic: 'yes' })
        .expect(400);
    });
  });

  // ── Intake Forms (new endpoints) ─────────────────────────────────────────

  describe('PATCH /dashboard/organization/intake-forms/:formId', () => {
    it('returns 200 on valid update', async () => {
      const form = { id: uuid(1), nameAr: 'نموذج معدّل', isActive: false, fields: [] };
      mockUpdateIntakeForm.execute.mockResolvedValue(form);

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/organization/intake-forms/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'نموذج معدّل', isActive: false })
        .expect(200);

      expect(res.body.nameAr).toBe('نموذج معدّل');
      expect(mockUpdateIntakeForm.execute).toHaveBeenCalledWith(
        expect.objectContaining({ formId: uuid(1), nameAr: 'نموذج معدّل', isActive: false }),
      );
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .patch('/dashboard/organization/intake-forms/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'x' })
        .expect(400);
    });
  });

  describe('PUT /dashboard/organization/intake-forms/:formId/fields', () => {
    it('returns 200 with replaced fields', async () => {
      const form = { id: uuid(1), nameAr: 'نموذج', fields: [{ id: uuid(2), labelAr: 'حقل' }] };
      mockSetIntakeFields.execute.mockResolvedValue(form);

      const res = await request(app.getHttpServer())
        .put(`/dashboard/organization/intake-forms/${uuid(1)}/fields`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ fields: [{ labelAr: 'حقل', fieldType: 'TEXT', isRequired: true }] })
        .expect(200);

      expect(res.body.fields).toHaveLength(1);
      expect(mockSetIntakeFields.execute).toHaveBeenCalledWith(
        expect.objectContaining({ formId: uuid(1) }),
      );
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .put('/dashboard/organization/intake-forms/not-a-uuid/fields')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ fields: [] })
        .expect(400);
    });
  });

  describe('GET /dashboard/organization/intake-forms/responses/:bookingId', () => {
    it('returns 200 with empty array (stub)', async () => {
      mockGetIntakeFormResponses.execute.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get(`/dashboard/organization/intake-forms/responses/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/organization/intake-forms/responses/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  // ── Session Packages (Phase 1B) ─────────────────────────────────────────

  describe('POST /dashboard/organization/packages', () => {
    const validPayload = () => ({
      nameAr: 'باقة العائلة',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      items: [
        {
          serviceId: uuid(1),
          employeeId: uuid(2),
          durationOptionId: uuid(3),
          paidQuantity: 4,
          freeQuantity: 1,
        },
      ],
    });

    it('returns 201 on a valid package creation', async () => {
      mockCreateSessionPackage.execute.mockResolvedValue({ id: uuid(1), nameAr: 'باقة العائلة' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/organization/packages')
        .set('Authorization', 'Bearer fake-jwt')
        .send(validPayload())
        .expect(201);

      expect(res.body.id).toBe(uuid(1));
      expect(mockCreateSessionPackage.execute).toHaveBeenCalledWith(validPayload());
    });

    it('returns 400 for missing required fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/packages')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'باقة العائلة' })
        .expect(400);
    });

    it('returns 400 for an empty items array', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/packages')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validPayload(), items: [] })
        .expect(400);
    });

    it('returns 400 for an unknown discountType', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/packages')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validPayload(), discountType: 'WHATEVER' })
        .expect(400);
    });

    it('returns 400 for unknown top-level fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/packages')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validPayload(), extra: 'bad' })
        .expect(400);
    });
  });

  describe('GET /dashboard/organization/packages', () => {
    it('returns 200 with the list payload', async () => {
      mockListSessionPackages.execute.mockResolvedValue({
        items: [{ id: uuid(1), nameAr: 'باقة العائلة' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/organization/packages')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.items).toHaveLength(1);
    });

    it('forwards query string filters to the handler', async () => {
      mockListSessionPackages.execute.mockResolvedValue({ items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false } });

      await request(app.getHttpServer())
        .get('/dashboard/organization/packages?isActive=true&search=family')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListSessionPackages.execute).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true, search: 'family' }),
      );
    });
  });

  describe('GET /dashboard/organization/packages/:packageId', () => {
    it('returns 200 with the package + computed price', async () => {
      mockGetSessionPackage.execute.mockResolvedValue({
        id: uuid(1),
        nameAr: 'باقة العائلة',
        price: { subtotal: 40000, discountAmount: 4000, finalPrice: 36000, itemUnitPrices: [] },
      });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/organization/packages/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.id).toBe(uuid(1));
      expect(res.body.price.finalPrice).toBe(36000);
      expect(mockGetSessionPackage.execute).toHaveBeenCalledWith({ packageId: uuid(1) });
    });

    it('returns 400 for an invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/organization/packages/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('PATCH /dashboard/organization/packages/:packageId', () => {
    it('returns 200 on a valid update', async () => {
      mockUpdateSessionPackage.execute.mockResolvedValue({ id: uuid(1), nameAr: 'باقة محدّثة' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/organization/packages/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'باقة محدّثة' })
        .expect(200);

      expect(res.body.nameAr).toBe('باقة محدّثة');
      expect(mockUpdateSessionPackage.execute).toHaveBeenCalledWith(
        expect.objectContaining({ packageId: uuid(1), nameAr: 'باقة محدّثة' }),
      );
    });

    it('returns 400 for an invalid UUID', async () => {
      return request(app.getHttpServer())
        .patch('/dashboard/organization/packages/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'x' })
        .expect(400);
    });
  });

  describe('DELETE /dashboard/organization/packages/:packageId', () => {
    it('returns 204 on archive', async () => {
      mockArchiveSessionPackage.execute.mockResolvedValue({ id: uuid(1) });

      return request(app.getHttpServer())
        .delete(`/dashboard/organization/packages/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);
    });

    it('returns 400 for an invalid UUID', async () => {
      return request(app.getHttpServer())
        .delete('/dashboard/organization/packages/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });
});
