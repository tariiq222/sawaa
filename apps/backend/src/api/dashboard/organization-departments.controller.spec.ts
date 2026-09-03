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
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

describe('DashboardOrganizationDepartmentsController (e2e)', () => {
  let app: INestApplication;
  let openApiDocument: OpenAPIObject;

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
    openApiDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Departments contract test').build(),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const validDepartment = { nameAr: 'قسم الأسنان' };
  const departmentId = '00000000-0000-4000-a000-000000000001';

  describe('OpenAPI response contracts', () => {
    it.each([
      ['post', '201', '#/components/schemas/DepartmentResponseDto'],
      ['get', '200', '#/components/schemas/PaginatedDepartmentsResponseDto'],
      ['patch', '200', '#/components/schemas/DepartmentResponseDto'],
    ] as const)('documents the %s department response', (method, status, schemaRef) => {
      const path = method === 'patch'
        ? '/dashboard/organization/departments/{departmentId}'
        : '/dashboard/organization/departments';
      const response = openApiDocument.paths[path]?.[method]?.responses?.[status];

      expect(response).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: schemaRef },
          },
        },
      });
    });

    it('documents the actual 200 JSON response on delete', () => {
      const responses = openApiDocument.paths[
        '/dashboard/organization/departments/{departmentId}'
      ]?.delete?.responses;

      expect(responses?.['200']).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DeleteDepartmentResponseDto' },
          },
        },
      });
      expect(responses?.['204']).toBeUndefined();
    });

    it('documents the list item, nested category, and pagination fields returned by the handler', () => {
      expect(openApiDocument.components?.schemas?.DepartmentListItemResponseDto).toMatchObject({
        required: expect.arrayContaining(['categories', 'bookableCategoriesCount']),
      });
      expect(openApiDocument.components?.schemas?.DepartmentCategoryResponseDto).toMatchObject({
        required: expect.arrayContaining([
          'id', 'ref', 'departmentId', 'nameAr', 'nameEn', 'sortOrder', 'isActive',
          'bookingMode', 'imageUrl', 'iconName', 'iconBgColor', 'createdAt', 'updatedAt',
        ]),
        properties: {
          bookingMode: { type: 'string', enum: ['DIRECT', 'SERVICES'] },
        },
      });
      expect(openApiDocument.components?.schemas?.DepartmentListMetaDto).toMatchObject({
        required: ['total', 'page', 'limit', 'totalPages', 'hasNextPage', 'hasPreviousPage'],
      });
    });
  });

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
        items: [{ id: departmentId, nameAr: 'قسم الأسنان', categories: [], bookableCategoriesCount: 0 }],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/organization/departments')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('passes query filters', async () => {
      mockList.execute.mockResolvedValue({
        items: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

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
      mockDelete.execute.mockResolvedValue({ deleted: true });

      const res = await request(app.getHttpServer())
        .delete(`/dashboard/organization/departments/${departmentId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toEqual({ deleted: true });
      expect(mockDelete.execute).toHaveBeenCalledWith({ departmentId });
    });
  });
});
