import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { PublicPackagesController } from './packages.controller';
import { ListPublicPackagesHandler } from '../../modules/org-experience/session-packages/list-public-packages/list-public-packages.handler';
import { GetPublicPackageHandler } from '../../modules/org-experience/session-packages/get-public-package/get-public-package.handler';

describe('PublicPackagesController (e2e)', () => {
  let app: INestApplication;

  const mockList = { execute: jest.fn() };
  const mockGet = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicPackagesController],
      providers: [
        { provide: ListPublicPackagesHandler, useValue: mockList },
        { provide: GetPublicPackageHandler, useValue: mockGet },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /public/packages', () => {
    it('returns 200 with the public catalog (no auth required)', async () => {
      mockList.execute.mockResolvedValue([
        { id: 'pkg-1', nameAr: 'باقة', isPublic: true, price: { finalPrice: 36_000 } },
      ]);

      const res = await request(app.getHttpServer()).get('/public/packages').expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('pkg-1');
      expect(res.body[0].price.finalPrice).toBe(36_000);
      expect(mockList.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /public/packages/:packageId', () => {
    it('returns 200 with the package detail', async () => {
      mockGet.execute.mockResolvedValue({ id: 'pkg-1', price: { finalPrice: 36_000 } });

      const res = await request(app.getHttpServer())
        .get('/public/packages/00000000-0000-4000-a000-000000000001')
        .expect(200);

      expect(res.body.id).toBe('pkg-1');
      expect(mockGet.execute).toHaveBeenCalledWith({
        packageId: '00000000-0000-4000-a000-000000000001',
      });
    });

    it('returns 404 when the package is not public/found', async () => {
      mockGet.execute.mockRejectedValue(new NotFoundException('Session package not found'));

      return request(app.getHttpServer())
        .get('/public/packages/00000000-0000-4000-a000-000000000099')
        .expect(404);
    });

    it('returns 400 for a non-UUID id (ParseUUIDPipe)', async () => {
      return request(app.getHttpServer()).get('/public/packages/not-a-uuid').expect(400);
    });
  });
});
