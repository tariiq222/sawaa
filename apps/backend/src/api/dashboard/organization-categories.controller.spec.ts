import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardOrganizationCategoriesController } from './organization-categories.controller';
import { CreateCategoryHandler } from '../../modules/org-config/categories/create-category.handler';
import { UpdateCategoryHandler } from '../../modules/org-config/categories/update-category.handler';
import { ListCategoriesHandler } from '../../modules/org-config/categories/list-categories.handler';
import { DeleteCategoryHandler } from '../../modules/org-config/categories/delete-category.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardOrganizationCategoriesController (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const validCategory = { nameAr: 'طب الأسنان' };
  const categoryId = '00000000-0000-4000-a000-000000000001';

  describe('POST /dashboard/organization/categories', () => {
    it('returns 201 on valid create', async () => {
      mockCreate.execute.mockResolvedValue({ id: categoryId, nameAr: 'طب الأسنان' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/organization/categories')
        .set('Authorization', 'Bearer fake-jwt')
        .send(validCategory)
        .expect(201);

      expect(res.body.id).toBe(categoryId);
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
        data: [{ id: categoryId, nameAr: 'طب الأسنان' }],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/organization/categories')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });

    it('passes query filters', async () => {
      mockList.execute.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });

      await request(app.getHttpServer())
        .get('/dashboard/organization/categories?departmentId=00000000-0000-4000-a000-000000000002&isActive=true&search=dental&page=1&limit=10')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockList.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: '00000000-0000-4000-a000-000000000002',
          isActive: true,
          search: 'dental',
        }),
      );
    });
  });

  describe('PATCH /dashboard/organization/categories/:categoryId', () => {
    it('returns 200 on update', async () => {
      mockUpdate.execute.mockResolvedValue({ id: categoryId, nameAr: 'طب العيون' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/organization/categories/${categoryId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ nameAr: 'طب العيون' })
        .expect(200);

      expect(res.body.nameAr).toBe('طب العيون');
      expect(mockUpdate.execute).toHaveBeenCalledWith({ categoryId, nameAr: 'طب العيون' });
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
      mockDelete.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/dashboard/organization/categories/${categoryId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockDelete.execute).toHaveBeenCalledWith({ categoryId });
    });
  });
});
