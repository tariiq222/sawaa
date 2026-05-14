import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardOrganizationDepartmentsController } from './organization-departments.controller';
import { CreateDepartmentHandler } from '../../modules/org-config/departments/create-department.handler';
import { UpdateDepartmentHandler } from '../../modules/org-config/departments/update-department.handler';
import { ListDepartmentsHandler } from '../../modules/org-config/departments/list-departments.handler';
import { DeleteDepartmentHandler } from '../../modules/org-config/departments/delete-department.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardOrganizationDepartmentsController (e2e)', () => {
  let app: INestApplication;

  const mockCreate = { execute: jest.fn() };
  const mockUpdate = { execute: jest.fn() };
  const mockList = { execute: jest.fn() };
  const mockDelete = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardOrganizationDepartmentsController],
      providers: [
        { provide: CreateDepartmentHandler, useValue: mockCreate },
        { provide: UpdateDepartmentHandler, useValue: mockUpdate },
        { provide: ListDepartmentsHandler, useValue: mockList },
        { provide: DeleteDepartmentHandler, useValue: mockDelete },
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

  const validDepartment = { nameAr: 'قسم الأسنان' };
  const departmentId = '00000000-0000-4000-a000-000000000001';

  describe('POST /dashboard/organization/departments', () => {
    it('returns 201 on valid create', async () => {
      mockCreate.execute.mockResolvedValue({ id: departmentId, nameAr: 'قسم الأسنان' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/organization/departments')
        .set('Authorization', 'Bearer fake-jwt')
        .send(validDepartment)
        .expect(201);

      expect(res.body.id).toBe(departmentId);
    });

    it('returns 400 for missing nameAr', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/departments')
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(400);
    });

    it('returns 400 for whitespace-only nameAr', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/departments')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: '   ' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/departments')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validDepartment, extra: 'bad' })
        .expect(400);
    });
  });

  describe('GET /dashboard/organization/departments', () => {
    it('returns 200 with paginated departments', async () => {
      mockList.execute.mockResolvedValue({
        data: [{ id: departmentId, nameAr: 'قسم الأسنان' }],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/organization/departments')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });

    it('passes query filters', async () => {
      mockList.execute.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });

      await request(app.getHttpServer())
        .get('/dashboard/organization/departments?isActive=true&search=dental&page=1&limit=10')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockList.execute).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true, search: 'dental' }),
      );
    });
  });

  describe('PATCH /dashboard/organization/departments/:departmentId', () => {
    it('returns 200 on update', async () => {
      mockUpdate.execute.mockResolvedValue({ id: departmentId, nameAr: 'قسم العيون' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/organization/departments/${departmentId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'قسم العيون' })
        .expect(200);

      expect(res.body.nameAr).toBe('قسم العيون');
      expect(mockUpdate.execute).toHaveBeenCalledWith({ departmentId, nameAr: 'قسم العيون' });
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .patch('/dashboard/organization/departments/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'Test' })
        .expect(400);
    });
  });

  describe('DELETE /dashboard/organization/departments/:departmentId', () => {
    it('returns 200 on delete', async () => {
      mockDelete.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/dashboard/organization/departments/${departmentId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockDelete.execute).toHaveBeenCalledWith({ departmentId });
    });
  });
});
