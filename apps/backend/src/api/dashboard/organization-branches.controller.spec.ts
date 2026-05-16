import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardOrganizationBranchesController } from './organization-branches.controller';
import { CreateBranchHandler } from '../../modules/org-config/branches/create-branch.handler';
import { UpdateBranchHandler } from '../../modules/org-config/branches/update-branch.handler';
import { ListBranchesHandler } from '../../modules/org-config/branches/list-branches.handler';
import { GetBranchHandler } from '../../modules/org-config/branches/get-branch.handler';
import { DeleteBranchHandler } from '../../modules/org-config/branches/delete-branch.handler';
import { ListBranchEmployeesHandler } from '../../modules/org-config/branches/list-branch-employees.handler';
import { AssignEmployeeToBranchHandler } from '../../modules/org-config/branches/assign-employee-to-branch.handler';
import { UnassignEmployeeFromBranchHandler } from '../../modules/org-config/branches/unassign-employee-from-branch.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardOrganizationBranchesController (e2e)', () => {
  let app: INestApplication;

  const mockCreate = { execute: jest.fn() };
  const mockUpdate = { execute: jest.fn() };
  const mockList = { execute: jest.fn() };
  const mockGet = { execute: jest.fn() };
  const mockDelete = { execute: jest.fn() };
  const mockListEmployees = { execute: jest.fn() };
  const mockAssign = { execute: jest.fn() };
  const mockUnassign = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardOrganizationBranchesController],
      providers: [
        { provide: CreateBranchHandler, useValue: mockCreate },
        { provide: UpdateBranchHandler, useValue: mockUpdate },
        { provide: ListBranchesHandler, useValue: mockList },
        { provide: GetBranchHandler, useValue: mockGet },
        { provide: DeleteBranchHandler, useValue: mockDelete },
        { provide: ListBranchEmployeesHandler, useValue: mockListEmployees },
        { provide: AssignEmployeeToBranchHandler, useValue: mockAssign },
        { provide: UnassignEmployeeFromBranchHandler, useValue: mockUnassign },
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

  const validBranch = { nameAr: 'فرع الرياض' };
  const branchId = '00000000-0000-4000-a000-000000000001';

  describe('POST /dashboard/organization/branches', () => {
    it('returns 201 on valid create', async () => {
      mockCreate.execute.mockResolvedValue({ id: branchId, nameAr: 'فرع الرياض' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/organization/branches')
        .set('Authorization', 'Bearer fake-jwt')
        .send(validBranch)
        .expect(201);

      expect(res.body.id).toBe(branchId);
    });

    it('returns 400 for missing nameAr', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/branches')
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/branches')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validBranch, extra: 'bad' })
        .expect(400);
    });
  });

  describe('GET /dashboard/organization/branches', () => {
    it('returns 200 with paginated branches', async () => {
      mockList.execute.mockResolvedValue({
        data: [{ id: branchId, nameAr: 'فرع الرياض' }],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/organization/branches')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });

    it('passes query filters', async () => {
      mockList.execute.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });

      await request(app.getHttpServer())
        .get('/dashboard/organization/branches?search=Riyadh&isActive=true&page=1&limit=10')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockList.execute).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Riyadh', isActive: true, page: 1, limit: 10 }),
      );
    });
  });

  describe('GET /dashboard/organization/branches/:branchId', () => {
    it('returns 200 with branch details', async () => {
      mockGet.execute.mockResolvedValue({ id: branchId, nameAr: 'فرع الرياض' });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/organization/branches/${branchId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.nameAr).toBe('فرع الرياض');
      expect(mockGet.execute).toHaveBeenCalledWith({ branchId });
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/organization/branches/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('PATCH /dashboard/organization/branches/:branchId', () => {
    it('returns 200 on update', async () => {
      mockUpdate.execute.mockResolvedValue({ id: branchId, nameAr: 'فرع جدة' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/organization/branches/${branchId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'فرع جدة' })
        .expect(200);

      expect(res.body.nameAr).toBe('فرع جدة');
      expect(mockUpdate.execute).toHaveBeenCalledWith({ branchId, nameAr: 'فرع جدة' });
    });
  });

  describe('DELETE /dashboard/organization/branches/:branchId', () => {
    it('returns 204 on delete', async () => {
      mockDelete.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/dashboard/organization/branches/${branchId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);

      expect(mockDelete.execute).toHaveBeenCalledWith({ branchId });
    });
  });

  describe('GET /dashboard/organization/branches/:branchId/employees', () => {
    it('returns 200 with employee list', async () => {
      mockListEmployees.execute.mockResolvedValue([{ id: 'emp-1', name: 'Khalid' }]);

      const res = await request(app.getHttpServer())
        .get(`/dashboard/organization/branches/${branchId}/employees`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /dashboard/organization/branches/:branchId/employees', () => {
    it('returns 201 on assign', async () => {
      mockAssign.execute.mockResolvedValue({ branchId, employeeId: 'emp-1' });

      await request(app.getHttpServer())
        .post(`/dashboard/organization/branches/${branchId}/employees`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ employeeId: '00000000-0000-4000-a000-000000000002' })
        .expect(201);

      expect(mockAssign.execute).toHaveBeenCalledWith({
        branchId,
        employeeId: '00000000-0000-4000-a000-000000000002',
      });
    });

    it('returns 400 for invalid employeeId', async () => {
      return request(app.getHttpServer())
        .post(`/dashboard/organization/branches/${branchId}/employees`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ employeeId: 'not-a-uuid' })
        .expect(400);
    });
  });

  describe('DELETE /dashboard/organization/branches/:branchId/employees/:employeeId', () => {
    it('returns 200 on unassign', async () => {
      mockUnassign.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/dashboard/organization/branches/${branchId}/employees/00000000-0000-4000-a000-000000000002`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockUnassign.execute).toHaveBeenCalledWith({
        branchId,
        employeeId: '00000000-0000-4000-a000-000000000002',
      });
    });
  });
});
