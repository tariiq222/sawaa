import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardContentController } from './content.controller';
import { ListSiteSettingsHandler } from '../../modules/content/site-settings/list-site-settings.handler';
import { BulkUpsertSiteSettingsHandler } from '../../modules/content/site-settings/bulk-upsert-site-settings.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardContentController (e2e)', () => {
  let app: INestApplication;

  const mockListSettings = { execute: jest.fn() };
  const mockBulkUpsert = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardContentController],
      providers: [
        { provide: ListSiteSettingsHandler, useValue: mockListSettings },
        { provide: BulkUpsertSiteSettingsHandler, useValue: mockBulkUpsert },
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

  describe('GET /dashboard/content/site-settings', () => {
    it('returns 200 with site settings', async () => {
      mockListSettings.execute.mockResolvedValue([
        { key: 'site.title', valueText: 'My Clinic', updatedAt: new Date().toISOString() },
      ]);

      const res = await request(app.getHttpServer())
        .get('/dashboard/content/site-settings')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].key).toBe('site.title');
    });

    it('passes prefix filter to handler', async () => {
      mockListSettings.execute.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/dashboard/content/site-settings?prefix=home.hero')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListSettings.execute).toHaveBeenCalledWith({ prefix: 'home.hero' });
    });
  });

  describe('POST /dashboard/content/site-settings', () => {
    it('returns 201 on valid upsert', async () => {
      mockBulkUpsert.execute.mockResolvedValue({ count: 2 });

      const res = await request(app.getHttpServer())
        .post('/dashboard/content/site-settings')
        .set('Authorization', 'Bearer fake-jwt')
        .send({
          entries: [
            { key: 'site.title', valueText: 'Updated Clinic' },
            { key: 'site.phone', valueText: '+966501234567' },
          ],
        })
        .expect(201);

      expect(res.body.count).toBe(2);
    });

    it('returns 400 for empty entries array', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/content/site-settings')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ entries: [] })
        .expect(400);
    });

    it('returns 400 for missing entries', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/content/site-settings')
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(400);
    });

    it('returns 400 for entry with long key', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/content/site-settings')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ entries: [{ key: 'x'.repeat(201), valueText: 'val' }] })
        .expect(400);
    });
  });
});
