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
  const mockAssignEmployeeService = { execute: jest.fn() };
  const mockRemoveEmployeeService = { execute: jest.fn() };
  const mockListEmployeeExceptions = { execute: jest.fn() };
  const mockCreateEmployeeException = { execute: jest.fn() };
  const mockDeleteEmployeeException = { execute: jest.fn() };
  const mockListEmployeeRatings = { execute: jest.fn() };
  const mockUploadAvatar = { execute: jest.fn() };
  const mockGetEmployeeBreaks = { execute: jest.fn() };
  const mockSetEmployeeBreaks = { execute: jest.fn() };

  beforeAll(async () => {
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
        { provide: AssignEmployeeServiceHandler, useValue: mockAssignEmployeeService },
        { provide: RemoveEmployeeServiceHandler, useValue: mockRemoveEmployeeService },
        { provide: ListEmployeeExceptionsHandler, useValue: mockListEmployeeExceptions },
        { provide: CreateEmployeeExceptionHandler, useValue: mockCreateEmployeeException },
        { provide: DeleteEmployeeExceptionHandler, useValue: mockDeleteEmployeeException },
        { provide: ListEmployeeRatingsHandler, useValue: mockListEmployeeRatings },
        { provide: UploadAvatarHandler, useValue: mockUploadAvatar },
        { provide: GetEmployeeBreaksHandler, useValue: mockGetEmployeeBreaks },
        { provide: SetEmployeeBreaksHandler, useValue: mockSetEmployeeBreaks },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = {
            sub: 'user-1',
            id: 'user-1',
            email: 'admin@example.com',
            role: 'ADMIN',
            isSuperAdmin: false,
            organizationId: '00000000-0000-4000-a000-000000000001',
          };
          return true;
        },
      })
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
    it('returns 200 on activate', async () => {
      mockSetClientActive.execute.mockResolvedValue({ id: uuid(1), isActive: true });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/people/clients/${uuid(1)}/active`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ isActive: true })
        .expect(200);

      expect(res.body.isActive).toBe(true);
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
});
