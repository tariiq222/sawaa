import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { DashboardOrganizationCategoriesController } from './organization-categories.controller';
import { CreateCategoryHandler } from '../../modules/org-config/categories/create-category.handler';
import { UpdateCategoryHandler } from '../../modules/org-config/categories/update-category.handler';
import { ListCategoriesHandler } from '../../modules/org-config/categories/list-categories.handler';
import { DeleteCategoryHandler } from '../../modules/org-config/categories/delete-category.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardOrganizationCategoriesController (e2e)', () => {
  let app: INestApplication;
  let openApiDocument: OpenAPIObject;

  const mockCreate = { execute: jest.fn() };
  const mockUpdate = { execute: jest.fn() };
  const mockList = { execute: jest.fn() };
  const mockDelete = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardOrganizationCategoriesController],
      providers: [
        { provide: CreateCategoryHandler, useValue: mockCreate },
        { provide: UpdateCategoryHandler, useValue: mockUpdate },
        { provide: ListCategoriesHandler, useValue: mockList },
        { provide: DeleteCategoryHandler, useValue: mockDelete },
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
      new DocumentBuilder().setTitle('Categories contract test').build(),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const validCategory = { nameAr: 'طب الأسنان' };
  const categoryId = '00000000-0000-4000-a000-000000000001';
  const categoryResponse = {
    id: categoryId,
    ref: 101,
    departmentId: null,
    nameAr: 'طب الأسنان',
    nameEn: null,
    sortOrder: 0,
    isActive: true,
    bookingMode: 'SERVICES',
    imageUrl: null,
    iconName: null,
    iconBgColor: null,
    createdAt: new Date('2026-09-05T10:00:00.000Z'),
    updatedAt: new Date('2026-09-05T10:00:00.000Z'),
  };
  const categoryWireResponse = {
    ...categoryResponse,
    createdAt: categoryResponse.createdAt.toISOString(),
    updatedAt: categoryResponse.updatedAt.toISOString(),
  };

  describe('OpenAPI response contracts', () => {
    it.each([
      ['post', '201', '/dashboard/organization/categories', '#/components/schemas/CategoryResponseDto'],
      ['get', '200', '/dashboard/organization/categories', '#/components/schemas/PaginatedCategoriesResponseDto'],
      ['patch', '200', '/dashboard/organization/categories/{categoryId}', '#/components/schemas/CategoryResponseDto'],
    ] as const)('documents the %s category response', (method, status, path, schemaRef) => {
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
        '/dashboard/organization/categories/{categoryId}'
      ]?.delete?.responses;

      expect(responses?.['200']).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DeleteCategoryResponseDto' },
          },
        },
      });
      expect(responses?.['204']).toBeUndefined();
      expect(responses?.['400']).toMatchObject({
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorDto' } } },
      });
      expect(responses?.['404']).toMatchObject({
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorDto' } } },
      });
    });

    it('documents scalar fields, nullable values, list relations, and pagination metadata', () => {
      const scalarSchema = openApiDocument.components?.schemas?.CategoryResponseDto;
      expect(scalarSchema).toMatchObject({
        required: expect.arrayContaining([
          'id', 'ref', 'departmentId', 'nameAr', 'nameEn', 'sortOrder', 'isActive',
          'bookingMode', 'imageUrl', 'iconName', 'iconBgColor', 'createdAt', 'updatedAt',
        ]),
        properties: {
          departmentId: { type: 'string', nullable: true },
          nameEn: { type: 'string', nullable: true },
          imageUrl: { type: 'string', nullable: true },
          iconName: { type: 'string', nullable: true },
          iconBgColor: { type: 'string', nullable: true },
          bookingMode: { type: 'string', enum: ['DIRECT', 'SERVICES'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      });

      expect(scalarSchema).toMatchObject({
        properties: {
          imageUrl: { description: expect.stringContaining('Displayable category image URL') },
        },
      });

      expect(openApiDocument.components?.schemas?.DeleteCategoryResponseDto).toMatchObject({
        properties: {
          imageUrl: { description: expect.stringContaining('Persisted image reference') },
        },
      });

      const listItemSchema = openApiDocument.components?.schemas?.CategoryListItemResponseDto;
      expect(listItemSchema).toMatchObject({
        required: expect.arrayContaining(['department', '_count']),
        properties: {
          department: {
            oneOf: expect.arrayContaining([
              { $ref: '#/components/schemas/CategoryDepartmentResponseDto' },
              { type: 'object', nullable: true, enum: [null] },
            ]),
          },
          _count: expect.anything(),
        },
      });

      expect(openApiDocument.components?.schemas?.CategoryDepartmentResponseDto).toMatchObject({
        required: ['id', 'nameAr', 'nameEn'],
        properties: {
          id: { type: 'string' },
          nameAr: { type: 'string' },
          nameEn: { type: 'string', nullable: true },
        },
      });
      expect(openApiDocument.components?.schemas?.CategoryCountResponseDto).toMatchObject({
        required: ['services'],
        properties: { services: { type: 'number' } },
      });
      expect(openApiDocument.components?.schemas?.CategoryListMetaDto).toMatchObject({
        required: ['total', 'page', 'limit', 'totalPages', 'hasNextPage', 'hasPreviousPage'],
      });

      const parameters = openApiDocument.paths['/dashboard/organization/categories']?.get?.parameters;
      expect(parameters).toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'page',
          schema: { type: 'integer', minimum: 1, default: 1 },
        }),
        expect.objectContaining({
          name: 'limit',
          schema: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
        }),
      ]));
    });
  });

  describe('POST /dashboard/organization/categories', () => {
    it('returns 201 on valid create', async () => {
      mockCreate.execute.mockResolvedValue(categoryResponse);

      const res = await request(app.getHttpServer())
        .post('/dashboard/organization/categories')
        .set('Authorization', 'Bearer fake-jwt')
        .send(validCategory)
        .expect(201);

      expect(res.body).toEqual(categoryWireResponse);
    });

    it('preserves an explicit null departmentId in the create body', async () => {
      mockCreate.execute.mockResolvedValue(categoryResponse);

      await request(app.getHttpServer())
        .post('/dashboard/organization/categories')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validCategory, departmentId: null })
        .expect(201);

      expect(mockCreate.execute).toHaveBeenCalledWith({ ...validCategory, departmentId: null });
    });

    it('returns 400 for missing nameAr', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/categories')
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(400);
    });

    it('returns 400 for invalid departmentId', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/categories')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'Test', departmentId: 'not-a-uuid' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/organization/categories')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validCategory, extra: 'bad' })
        .expect(400);
    });
  });

  describe('GET /dashboard/organization/categories', () => {
    it('returns 200 with paginated categories', async () => {
      mockList.execute.mockResolvedValue({
        items: [{
          ...categoryResponse,
          department: null,
          _count: { services: 0 },
        }],
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
        .get('/dashboard/organization/categories')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toEqual({
        items: [{
          ...categoryWireResponse,
          department: null,
          _count: { services: 0 },
        }],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });

    it('passes query filters', async () => {
      mockList.execute.mockResolvedValue({
        items: [],
        meta: {
          total: 0,
          page: 2,
          limit: 10,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: true,
        },
      });

      await request(app.getHttpServer())
        .get('/dashboard/organization/categories?departmentId=00000000-0000-4000-a000-000000000002&isActive=false&search=dental&page=2&limit=10')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockList.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: '00000000-0000-4000-a000-000000000002',
          isActive: false,
          search: 'dental',
          page: 2,
          limit: 10,
        }),
      );
    });

    it.each(['page=0', 'limit=201'])('rejects invalid numeric pagination query %s', async (query) => {
      await request(app.getHttpServer())
        .get(`/dashboard/organization/categories?${query}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);

      expect(mockList.execute).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /dashboard/organization/categories/:categoryId', () => {
    it('returns 200 on update', async () => {
      const updatedCategoryResponse = {
        ...categoryResponse,
        nameAr: 'طب العيون',
        departmentId: null,
        nameEn: null,
        imageUrl: null,
        iconName: null,
        iconBgColor: null,
        updatedAt: new Date('2026-09-05T11:00:00.000Z'),
      };
      mockUpdate.execute.mockResolvedValue(updatedCategoryResponse);

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/organization/categories/${categoryId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'طب العيون', nameEn: null, departmentId: null })
        .expect(200);

      expect(res.body).toEqual({
        ...updatedCategoryResponse,
        createdAt: updatedCategoryResponse.createdAt.toISOString(),
        updatedAt: updatedCategoryResponse.updatedAt.toISOString(),
      });
      expect(mockUpdate.execute).toHaveBeenCalledWith({
        categoryId,
        nameAr: 'طب العيون',
        nameEn: null,
        departmentId: null,
      });
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .patch('/dashboard/organization/categories/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'Test' })
        .expect(400);
    });
  });

  describe('DELETE /dashboard/organization/categories/:categoryId', () => {
    it('returns 200 on delete', async () => {
      mockDelete.execute.mockResolvedValue(categoryResponse);

      const res = await request(app.getHttpServer())
        .delete(`/dashboard/organization/categories/${categoryId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toEqual(categoryWireResponse);
      expect(mockDelete.execute).toHaveBeenCalledWith({ categoryId });
    });

    it('returns 400 when linked services prevent deletion', async () => {
      mockDelete.execute.mockRejectedValueOnce(
        new BadRequestException('Category has active services'),
      );

      await request(app.getHttpServer())
        .delete(`/dashboard/organization/categories/${categoryId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });

    it('returns 404 when the category does not exist', async () => {
      mockDelete.execute.mockRejectedValueOnce(new NotFoundException('Category not found'));

      await request(app.getHttpServer())
        .delete(`/dashboard/organization/categories/${categoryId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(404);
    });
  });
});
