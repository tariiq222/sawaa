import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardPeopleController } from './people.controller';
import { CreateClientHandler } from '../../modules/people/clients/create-client.handler';
import { UpdateClientHandler } from '../../modules/people/clients/update-client.handler';
import { ListClientsHandler } from '../../modules/people/clients/list-clients.handler';
import { GetClientHandler } from '../../modules/people/clients/get-client.handler';
import { DeleteClientHandler } from '../../modules/people/clients/delete-client.handler';
import { SetClientActiveHandler } from '../../modules/people/clients/set-client-active/set-client-active.handler';
import { CreateEmployeeHandler } from '../../modules/people/employees/create-employee.handler';
import { ListEmployeesHandler } from '../../modules/people/employees/list-employees.handler';
import { GetEmployeeHandler } from '../../modules/people/employees/get-employee.handler';
import { UpdateEmployeeHandler } from '../../modules/people/employees/update-employee.handler';
import { DeleteEmployeeHandler } from '../../modules/people/employees/delete-employee.handler';
import { EmployeeStatsHandler } from '../../modules/people/employees/employee-stats.handler';
import { UpdateAvailabilityHandler } from '../../modules/people/employees/update-availability.handler';
import { EmployeeOnboardingHandler } from '../../modules/people/employees/employee-onboarding.handler';
import { OnboardEmployeeHandler } from '../../modules/people/employees/onboard-employee.handler';
import { GetAvailabilityHandler } from '../../modules/people/employees/get-availability.handler';
import { ListEmployeeServicesHandler } from '../../modules/people/employees/list-employee-services.handler';
import { GetEmployeeServiceTypesHandler } from '../../modules/people/employees/get-employee-service-types.handler';
import { CheckAvailabilityHandler } from '../../modules/bookings/check-availability/check-availability.handler';
import { AssignEmployeeServiceHandler } from '../../modules/people/employees/assign-employee-service.handler';
import { RemoveEmployeeServiceHandler } from '../../modules/people/employees/remove-employee-service.handler';
import { ListEmployeeExceptionsHandler } from '../../modules/people/employees/list-employee-exceptions.handler';
import { CreateEmployeeExceptionHandler } from '../../modules/people/employees/create-employee-exception.handler';
import { DeleteEmployeeExceptionHandler } from '../../modules/people/employees/delete-employee-exception.handler';
import { ListEmployeeRatingsHandler } from '../../modules/people/employees/list-employee-ratings.handler';
import { UploadAvatarHandler } from '../../modules/people/employees/upload-avatar/upload-avatar.handler';
import { GetEmployeeBreaksHandler } from '../../modules/people/employees/get-employee-breaks/get-employee-breaks.handler';
import { SetEmployeeBreaksHandler } from '../../modules/people/employees/set-employee-breaks/set-employee-breaks.handler';
import { UpdateEmployeeServiceHandler } from '../../modules/people/employees/update-employee-service.handler';
import { SetEmployeeServiceOptionsHandler } from '../../modules/org-experience/services/set-employee-service-options.handler';
import { SetEmployeeCustomPricingHandler } from '../../modules/org-experience/services/set-employee-custom-pricing/set-employee-custom-pricing.handler';
import { SetEmployeeDurationsHandler } from '../../modules/org-experience/services/set-employee-durations/set-employee-durations.handler';
import { SetEmployeeDeliveryTypesHandler } from '../../modules/org-experience/services/set-employee-delivery-types/set-employee-delivery-types.handler';
import { SetEmployeePricingModeHandler } from '../../modules/org-experience/services/set-employee-pricing-mode/set-employee-pricing-mode.handler';
import { GetEmployeeAccountHandler } from '../../modules/identity/employee-account/get-employee-account.handler';
import { CreateEmployeeAccountHandler } from '../../modules/identity/employee-account/create-employee-account.handler';
import { UpdateEmployeeAccountHandler } from '../../modules/identity/employee-account/update-employee-account.handler';
import { GetMainBranchHandler } from '../../modules/org-config/branches/get-main-branch.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardPeopleController (e2e)', () => {
  let app: INestApplication;

  const mockCreateClient = { execute: jest.fn() };
  const mockUpdateClient = { execute: jest.fn() };
  const mockListClients = { execute: jest.fn() };
  const mockGetClient = { execute: jest.fn() };
  const mockDeleteClient = { execute: jest.fn() };
  const mockSetClientActive = { execute: jest.fn() };
  const mockCreateEmployee = { execute: jest.fn() };
  const mockListEmployees = { execute: jest.fn() };
  const mockGetEmployee = { execute: jest.fn() };
  const mockUpdateEmployee = { execute: jest.fn() };
  const mockDeleteEmployee = { execute: jest.fn() };
  const mockEmployeeStats = { execute: jest.fn() };
  const mockUpdateAvailability = { execute: jest.fn() };
  const mockEmployeeOnboarding = { execute: jest.fn() };
  const mockOnboardEmployee = { execute: jest.fn() };
  const mockGetAvailability = { execute: jest.fn() };
  const mockListEmployeeServices = { execute: jest.fn() };
  const mockGetEmployeeServiceTypes = { execute: jest.fn() };
  const mockCheckAvailability = { execute: jest.fn() };
  const mockGetMainBranch = { execute: jest.fn() };
  const mockAssignEmployeeService = { execute: jest.fn() };
  const mockRemoveEmployeeService = { execute: jest.fn() };
  const mockListEmployeeExceptions = { execute: jest.fn() };
  const mockCreateEmployeeException = { execute: jest.fn() };
  const mockDeleteEmployeeException = { execute: jest.fn() };
  const mockListEmployeeRatings = { execute: jest.fn() };
  const mockUploadAvatar = { execute: jest.fn() };
  const mockGetEmployeeBreaks = { execute: jest.fn() };
  const mockSetEmployeeBreaks = { execute: jest.fn() };
  const mockUpdateEmployeeService = { execute: jest.fn() };
  const mockSetEmployeeServiceOptions = { execute: jest.fn() };
  const mockSetEmployeeCustomPricing = { execute: jest.fn() };
  const mockSetEmployeeDurations = { execute: jest.fn() };
  const mockSetEmployeeDeliveryTypes = { execute: jest.fn() };
  const mockSetEmployeePricingMode = { execute: jest.fn() };
  const mockGetEmployeeAccount = { execute: jest.fn() };
  const mockCreateEmployeeAccount = { execute: jest.fn() };
  const mockUpdateEmployeeAccount = { execute: jest.fn() };

  const jwtGuardCanActivate = (ctx: any) => {
    ctx.switchToHttp().getRequest().user = {
      sub: 'user-1',
      id: 'user-1',
      email: 'admin@example.com',
      role: 'ADMIN',
      isSuperAdmin: false,
      organizationId: '00000000-0000-4000-a000-000000000001',
    };
    return true;
  };

  const buildModule = async (jwtGuardValue: any) => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardPeopleController],
      providers: [
        { provide: CreateClientHandler, useValue: mockCreateClient },
        { provide: UpdateClientHandler, useValue: mockUpdateClient },
        { provide: ListClientsHandler, useValue: mockListClients },
        { provide: GetClientHandler, useValue: mockGetClient },
        { provide: DeleteClientHandler, useValue: mockDeleteClient },
        { provide: SetClientActiveHandler, useValue: mockSetClientActive },
        { provide: CreateEmployeeHandler, useValue: mockCreateEmployee },
        { provide: ListEmployeesHandler, useValue: mockListEmployees },
        { provide: GetEmployeeHandler, useValue: mockGetEmployee },
        { provide: UpdateEmployeeHandler, useValue: mockUpdateEmployee },
        { provide: DeleteEmployeeHandler, useValue: mockDeleteEmployee },
        { provide: EmployeeStatsHandler, useValue: mockEmployeeStats },
        { provide: UpdateAvailabilityHandler, useValue: mockUpdateAvailability },
        { provide: EmployeeOnboardingHandler, useValue: mockEmployeeOnboarding },
        { provide: OnboardEmployeeHandler, useValue: mockOnboardEmployee },
        { provide: GetAvailabilityHandler, useValue: mockGetAvailability },
        { provide: ListEmployeeServicesHandler, useValue: mockListEmployeeServices },
        { provide: GetEmployeeServiceTypesHandler, useValue: mockGetEmployeeServiceTypes },
        { provide: CheckAvailabilityHandler, useValue: mockCheckAvailability },
        { provide: GetMainBranchHandler, useValue: mockGetMainBranch },
        { provide: AssignEmployeeServiceHandler, useValue: mockAssignEmployeeService },
        { provide: RemoveEmployeeServiceHandler, useValue: mockRemoveEmployeeService },
        { provide: ListEmployeeExceptionsHandler, useValue: mockListEmployeeExceptions },
        { provide: CreateEmployeeExceptionHandler, useValue: mockCreateEmployeeException },
        { provide: DeleteEmployeeExceptionHandler, useValue: mockDeleteEmployeeException },
        { provide: ListEmployeeRatingsHandler, useValue: mockListEmployeeRatings },
        { provide: UploadAvatarHandler, useValue: mockUploadAvatar },
        { provide: GetEmployeeBreaksHandler, useValue: mockGetEmployeeBreaks },
        { provide: SetEmployeeBreaksHandler, useValue: mockSetEmployeeBreaks },
        { provide: UpdateEmployeeServiceHandler, useValue: mockUpdateEmployeeService },
        { provide: SetEmployeeServiceOptionsHandler, useValue: mockSetEmployeeServiceOptions },
        { provide: SetEmployeeCustomPricingHandler, useValue: mockSetEmployeeCustomPricing },
        { provide: SetEmployeeDurationsHandler, useValue: mockSetEmployeeDurations },
        { provide: SetEmployeeDeliveryTypesHandler, useValue: mockSetEmployeeDeliveryTypes },
        { provide: SetEmployeePricingModeHandler, useValue: mockSetEmployeePricingMode },
        { provide: GetEmployeeAccountHandler, useValue: mockGetEmployeeAccount },
        { provide: CreateEmployeeAccountHandler, useValue: mockCreateEmployeeAccount },
        { provide: UpdateEmployeeAccountHandler, useValue: mockUpdateEmployeeAccount },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue(jwtGuardValue)
      .overrideGuard(CaslGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const application = moduleRef.createNestApplication();
    application.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await application.init();
    return application;
  };

  beforeAll(async () => {
    app = await buildModule({ canActivate: jwtGuardCanActivate });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const uuid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
  const validPhone = '+966501234567';

  // ── Clients ────────────────────────────────────────────────────────────────

  describe('POST /dashboard/people/clients', () => {
    it('returns 201 on valid client creation', async () => {
      mockCreateClient.execute.mockResolvedValue({ id: uuid(1), firstName: 'Sara', lastName: 'Ali' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/people/clients')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ firstName: 'Sara', lastName: 'Ali', phone: validPhone })
        .expect(201);

      expect(res.body.firstName).toBe('Sara');
    });

    it('returns 400 for missing required fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/people/clients')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ firstName: 'Sara' })
        .expect(400);
    });

    it('returns 400 for invalid phone', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/people/clients')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ firstName: 'Sara', lastName: 'Ali', phone: '+123' })
        .expect(400);
    });
  });

  describe('GET /dashboard/people/clients', () => {
    it('returns 200 with paginated clients', async () => {
      mockListClients.execute.mockResolvedValue({
        data: [{ id: uuid(1), firstName: 'Sara' }],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/people/clients')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(mockListClients.execute).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: undefined, page: 1, limit: 20 }),
      );
    });

    it('passes isActive=true when query param is "true"', async () => {
      mockListClients.execute.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });

      await request(app.getHttpServer())
        .get('/dashboard/people/clients?isActive=true')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListClients.execute).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });

    it('passes isActive=false when query param is "false"', async () => {
      mockListClients.execute.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });

      await request(app.getHttpServer())
        .get('/dashboard/people/clients?isActive=false')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListClients.execute).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  describe('GET /dashboard/people/clients/:id', () => {
    it('returns 200 with client details', async () => {
      mockGetClient.execute.mockResolvedValue({ id: uuid(1), firstName: 'Sara', lastName: 'Ali' });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/people/clients/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.firstName).toBe('Sara');
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/people/clients/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('PATCH /dashboard/people/clients/:id', () => {
    it('returns 200 on valid update', async () => {
      mockUpdateClient.execute.mockResolvedValue({ id: uuid(1), firstName: 'Updated' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/people/clients/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ firstName: 'Updated' })
        .expect(200);

      expect(res.body.firstName).toBe('Updated');
    });
  });

  describe('DELETE /dashboard/people/clients/:id', () => {
    it('returns 204 on delete', async () => {
      mockDeleteClient.execute.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete(`/dashboard/people/clients/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);
    });
  });

  describe('PATCH /dashboard/people/clients/:id/active', () => {
    it('returns 200 on activate with actorUserId from JWT', async () => {
      mockSetClientActive.execute.mockResolvedValue({ id: uuid(1), isActive: true });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/people/clients/${uuid(1)}/active`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ isActive: true })
        .expect(200);

      expect(res.body.isActive).toBe(true);
      expect(mockSetClientActive.execute).toHaveBeenCalledWith(
        expect.objectContaining({ actorUserId: 'user-1' }),
      );
    });

    it('returns 200 with undefined actorUserId when JWT guard omits user', async () => {
      mockSetClientActive.execute.mockResolvedValue({ id: uuid(1), isActive: false });

      const noUserApp = await buildModule({ canActivate: () => true });

      const res = await request(noUserApp.getHttpServer())
        .patch(`/dashboard/people/clients/${uuid(1)}/active`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ isActive: false, reason: 'test' })
        .expect(200);

      expect(res.body.isActive).toBe(false);
      expect(mockSetClientActive.execute).toHaveBeenCalledWith(
        expect.objectContaining({ actorUserId: undefined }),
      );

      await noUserApp.close();
    });

    it('returns 400 when isActive is missing', async () => {
      return request(app.getHttpServer())
        .patch(`/dashboard/people/clients/${uuid(1)}/active`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(400);
    });
  });

  // ── Employees ──────────────────────────────────────────────────────────────

  describe('POST /dashboard/people/employees', () => {
    it('returns 201 on valid employee creation', async () => {
      mockCreateEmployee.execute.mockResolvedValue({ id: uuid(2), name: 'Khalid' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/people/employees')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ name: 'Khalid' })
        .expect(201);

      expect(res.body.name).toBe('Khalid');
    });

    it('returns 400 for name exceeding max length', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/people/employees')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ name: 'A'.repeat(201) })
        .expect(400);
    });
  });

  describe('POST /dashboard/people/employees/onboarding', () => {
    it('returns 201 on onboard employee', async () => {
      mockOnboardEmployee.execute.mockResolvedValue({
        success: true,
        message: 'Employee onboarded successfully',
        employee: { id: uuid(2) },
      });

      const res = await request(app.getHttpServer())
        .post('/dashboard/people/employees/onboarding')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameEn: 'Khalid', nameAr: 'خالد', email: 'k@example.com', specialty: 'PT' })
        .expect(201);

      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /dashboard/people/employees', () => {
    it('returns 200 with paginated employees', async () => {
      mockListEmployees.execute.mockResolvedValue({
        data: [{ id: uuid(2), name: 'Khalid' }],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/people/employees')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(mockListEmployees.execute).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: undefined, page: 1, limit: 20 }),
      );
    });

    it('passes isActive=true when query param is "true"', async () => {
      mockListEmployees.execute.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });

      await request(app.getHttpServer())
        .get('/dashboard/people/employees?isActive=true')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListEmployees.execute).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });

    it('passes isActive=false when query param is "false"', async () => {
      mockListEmployees.execute.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });

      await request(app.getHttpServer())
        .get('/dashboard/people/employees?isActive=false')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListEmployees.execute).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  describe('GET /dashboard/people/employees/stats', () => {
    it('returns 200 with employee stats', async () => {
      mockEmployeeStats.execute.mockResolvedValue({ total: 5, active: 4 });

      const res = await request(app.getHttpServer())
        .get('/dashboard/people/employees/stats')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.total).toBe(5);
    });
  });

  describe('GET /dashboard/people/employees/:id', () => {
    it('returns 200 with employee details', async () => {
      mockGetEmployee.execute.mockResolvedValue({ id: uuid(2), name: 'Khalid' });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/people/employees/${uuid(2)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.name).toBe('Khalid');
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/people/employees/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('PATCH /dashboard/people/employees/:id', () => {
    it('returns 200 on valid update', async () => {
      mockUpdateEmployee.execute.mockResolvedValue({ id: uuid(2), name: 'Updated' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/people/employees/${uuid(2)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameEn: 'Updated' })
        .expect(200);

      expect(res.body.name).toBe('Updated');
    });
  });

  describe('DELETE /dashboard/people/employees/:id', () => {
    it('returns 204 on delete', async () => {
      mockDeleteEmployee.execute.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete(`/dashboard/people/employees/${uuid(2)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);
    });
  });

  describe('GET /dashboard/people/employees/:id/availability', () => {
    it('returns 200 with availability schedule', async () => {
      mockGetAvailability.execute.mockResolvedValue({
        schedule: [{ id: uuid(3), dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }],
      });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/people/employees/${uuid(2)}/availability`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.schedule).toHaveLength(1);
    });
  });

  describe('GET /dashboard/people/employees/:id/breaks', () => {
    it('returns 200 with break schedule', async () => {
      mockGetEmployeeBreaks.execute.mockResolvedValue({
        breaks: [{ id: uuid(3), dayOfWeek: 1, startTime: '13:00', endTime: '14:00' }],
      });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/people/employees/${uuid(2)}/breaks`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.breaks).toHaveLength(1);
    });
  });

  describe('PUT /dashboard/people/employees/:id/breaks', () => {
    it('returns 200 when setting breaks', async () => {
      mockSetEmployeeBreaks.execute.mockResolvedValue({
        breaks: [{ id: uuid(3), dayOfWeek: 1, startTime: '12:00', endTime: '13:00' }],
      });

      const res = await request(app.getHttpServer())
        .put(`/dashboard/people/employees/${uuid(2)}/breaks`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ breaks: [{ dayOfWeek: 1, startTime: '12:00', endTime: '13:00' }] })
        .expect(200);

      expect(res.body.breaks).toHaveLength(1);
    });
  });

  describe('GET /dashboard/people/employees/:id/vacations', () => {
    it('returns 200 with vacations list', async () => {
      mockListEmployeeExceptions.execute.mockResolvedValue([
        { id: uuid(3), startDate: '2026-05-01T00:00:00Z', endDate: '2026-05-07T00:00:00Z', reason: 'Vacation' },
      ]);

      const res = await request(app.getHttpServer())
        .get(`/dashboard/people/employees/${uuid(2)}/vacations`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /dashboard/people/employees/:id/vacations', () => {
    it('returns 201 on create vacation', async () => {
      mockCreateEmployeeException.execute.mockResolvedValue({
        id: uuid(3),
        employeeId: uuid(2),
        startDate: '2026-05-01T00:00:00Z',
        endDate: '2026-05-07T00:00:00Z',
        reason: 'Vacation',
      });

      const res = await request(app.getHttpServer())
        .post(`/dashboard/people/employees/${uuid(2)}/vacations`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ startDate: '2026-05-01T00:00:00.000Z', endDate: '2026-05-07T00:00:00.000Z', reason: 'Vacation' })
        .expect(201);

      expect(res.body.reason).toBe('Vacation');
    });
  });

  describe('DELETE /dashboard/people/employees/:id/vacations/:vacationId', () => {
    it('returns 204 on delete vacation', async () => {
      mockDeleteEmployeeException.execute.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete(`/dashboard/people/employees/${uuid(2)}/vacations/${uuid(3)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);
    });
  });

  describe('PATCH /dashboard/people/employees/:id/availability', () => {
    it('returns 200 on update availability', async () => {
      mockUpdateAvailability.execute.mockResolvedValue({
        windows: [{ id: uuid(3), dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }],
        exceptions: [],
      });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/people/employees/${uuid(2)}/availability`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({
          windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }],
          exceptions: [],
        })
        .expect(200);

      expect(res.body.windows).toHaveLength(1);
    });
  });

  describe('POST /dashboard/people/employees/:id/onboarding', () => {
    it('returns 200 on onboarding step', async () => {
      mockEmployeeOnboarding.execute.mockResolvedValue({ id: uuid(2), name: 'Khalid' });

      const res = await request(app.getHttpServer())
        .post(`/dashboard/people/employees/${uuid(2)}/onboarding`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ step: 'profile', profile: { name: 'Khalid' } })
        .expect(200);

      expect(res.body.id).toBe(uuid(2));
    });
  });

  describe('GET /dashboard/people/employees/:id/services', () => {
    it('returns 200 with employee services', async () => {
      mockListEmployeeServices.execute.mockResolvedValue([
        { id: uuid(4), employeeId: uuid(2), serviceId: uuid(5), service: { id: uuid(5), name: 'Therapy', price: 300, isActive: true } },
      ]);

      const res = await request(app.getHttpServer())
        .get(`/dashboard/people/employees/${uuid(2)}/services`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /dashboard/people/employees/:id/services', () => {
    it('returns 201 on assign service', async () => {
      mockAssignEmployeeService.execute.mockResolvedValue({
        id: uuid(4), employeeId: uuid(2), serviceId: uuid(5), createdAt: '2026-01-01T00:00:00Z',
      });

      const res = await request(app.getHttpServer())
        .post(`/dashboard/people/employees/${uuid(2)}/services`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ serviceId: uuid(5) })
        .expect(201);

      expect(res.body.serviceId).toBe(uuid(5));
    });

    it('returns 400 when serviceId is missing', async () => {
      await request(app.getHttpServer())
        .post(`/dashboard/people/employees/${uuid(2)}/services`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(400);

      expect(mockAssignEmployeeService.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when serviceId is not a UUID', async () => {
      await request(app.getHttpServer())
        .post(`/dashboard/people/employees/${uuid(2)}/services`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ serviceId: 'not-a-uuid' })
        .expect(400);

      expect(mockAssignEmployeeService.execute).not.toHaveBeenCalled();
    });
  });

  describe('GET /dashboard/people/employees/:id/slots', () => {
    it('returns 200 with slots without duration', async () => {
      const start = new Date('2026-05-01T09:00:00Z');
      const end = new Date('2026-05-01T09:30:00Z');
      mockGetMainBranch.execute.mockResolvedValue({ id: 'resolved-branch-id', isMain: true });
      mockCheckAvailability.execute.mockResolvedValue([{ startTime: start, endTime: end }]);

      const res = await request(app.getHttpServer())
        .get(`/dashboard/people/employees/${uuid(2)}/slots?date=2026-05-01`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toEqual([{ startTime: '09:00', endTime: '09:30' }]);
      expect(mockCheckAvailability.execute).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'resolved-branch-id', durationMins: undefined }),
      );
    });

    it('returns 200 with slots including single-digit hour padding (formatHHmm branch)', async () => {
      const start = new Date('2026-05-01T08:05:00Z');
      const end = new Date('2026-05-01T10:15:00Z');
      mockGetMainBranch.execute.mockResolvedValue({ id: 'resolved-branch-id', isMain: true });
      mockCheckAvailability.execute.mockResolvedValue([{ startTime: start, endTime: end }]);

      const res = await request(app.getHttpServer())
        .get(`/dashboard/people/employees/${uuid(2)}/slots?date=2026-05-01&duration=45`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toEqual([{ startTime: '08:05', endTime: '10:15' }]);
      expect(mockCheckAvailability.execute).toHaveBeenCalledWith(
        expect.objectContaining({ durationMins: 45 }),
      );
    });

    it('returns 400 for missing date', async () => {
      return request(app.getHttpServer())
        .get(`/dashboard/people/employees/${uuid(2)}/slots`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('GET /dashboard/people/employees/:id/services/:serviceId/types', () => {
    it('returns 200 with service types', async () => {
      mockGetEmployeeServiceTypes.execute.mockResolvedValue([
        { id: 'link-uuid:IN_PERSON', employeeServiceId: uuid(4), bookingType: 'in_person', price: 300, duration: 60, useCustomOptions: false, isActive: true, durationOptions: [] },
      ]);

      const res = await request(app.getHttpServer())
        .get(`/dashboard/people/employees/${uuid(2)}/services/${uuid(5)}/types`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(1);
    });
  });

  describe('DELETE /dashboard/people/employees/:id/services/:serviceId', () => {
    it('returns 204 on remove service', async () => {
      mockRemoveEmployeeService.execute.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete(`/dashboard/people/employees/${uuid(2)}/services/${uuid(5)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);
    });
  });

  describe('GET /dashboard/people/employees/:id/exceptions', () => {
    it('returns 200 with exceptions list', async () => {
      mockListEmployeeExceptions.execute.mockResolvedValue([
        { id: uuid(3), employeeId: uuid(2), startDate: '2026-05-01T00:00:00Z', endDate: '2026-05-02T00:00:00Z', reason: 'Sick leave', isStartTimeOnly: false },
      ]);

      const res = await request(app.getHttpServer())
        .get(`/dashboard/people/employees/${uuid(2)}/exceptions`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /dashboard/people/employees/:id/exceptions', () => {
    it('returns 201 on create exception', async () => {
      mockCreateEmployeeException.execute.mockResolvedValue({
        id: uuid(3), employeeId: uuid(2), startDate: '2026-05-01T00:00:00Z', endDate: '2026-05-02T00:00:00Z', reason: 'Sick leave', isStartTimeOnly: false,
      });

      const res = await request(app.getHttpServer())
        .post(`/dashboard/people/employees/${uuid(2)}/exceptions`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ startDate: '2026-05-01T00:00:00.000Z', endDate: '2026-05-02T00:00:00.000Z', reason: 'Sick leave' })
        .expect(201);

      expect(res.body.reason).toBe('Sick leave');
    });
  });

  describe('DELETE /dashboard/people/employees/:id/exceptions/:exceptionId', () => {
    it('returns 204 on delete exception', async () => {
      mockDeleteEmployeeException.execute.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete(`/dashboard/people/employees/${uuid(2)}/exceptions/${uuid(3)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);
    });
  });

  describe('GET /dashboard/people/employees/:id/ratings', () => {
    it('returns 200 with paginated ratings', async () => {
      mockListEmployeeRatings.execute.mockResolvedValue({
        items: [{ id: uuid(6), employeeId: uuid(2), score: 5, comment: 'Great', isPublic: true, createdAt: '2026-01-01T00:00:00Z' }],
        meta: { total: 1, page: 1, perPage: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
      });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/people/employees/${uuid(2)}/ratings`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.items).toHaveLength(1);
    });
  });

  describe('POST /dashboard/people/employees/:employeeId/avatar', () => {
    it('returns 201 on avatar upload', async () => {
      mockUploadAvatar.execute.mockResolvedValue({ fileId: uuid(7), url: 'https://cdn.example.com/avatar.jpg' });

      const res = await request(app.getHttpServer())
        .post(`/dashboard/people/employees/${uuid(2)}/avatar`)
        .set('Authorization', 'Bearer fake-jwt')
        .attach('file', Buffer.from('fake-image'), 'avatar.png')
        .expect(201);

      expect(res.body.url).toBe('https://cdn.example.com/avatar.jpg');
    });

    it('returns 400 when no file is uploaded', async () => {
      return request(app.getHttpServer())
        .post(`/dashboard/people/employees/${uuid(2)}/avatar`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('PUT /dashboard/people/employees/:id/services/:serviceId/durations', () => {
    it('calls setEmployeeDurations.execute with employeeId, serviceId, and body', async () => {
      const mockResult = [{ deliveryType: 'IN_PERSON', durations: [] }];
      mockSetEmployeeDurations.execute.mockResolvedValue(mockResult);

      const body = {
        durations: [
          {
            deliveryType: 'IN_PERSON',
            items: [
              { label: '60 min session', labelAr: 'جلسة 60 دقيقة', durationMins: 60, price: 30000 },
            ],
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .put(`/dashboard/people/employees/${uuid(2)}/services/${uuid(5)}/durations`)
        .set('Authorization', 'Bearer fake-jwt')
        .send(body)
        .expect(200);

      expect(mockSetEmployeeDurations.execute).toHaveBeenCalledWith({
        employeeId: uuid(2),
        serviceId: uuid(5),
        ...body,
      });
      expect(res.body).toEqual(mockResult);
    });
  });
});
