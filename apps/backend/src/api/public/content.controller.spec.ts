import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PublicContentController } from './content.controller';
import { ListSiteSettingsHandler } from '../../modules/content/site-settings/list-site-settings.handler';

describe('PublicContentController (e2e)', () => {
  let app: INestApplication;

  const mockListSettings = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicContentController],
      providers: [{ provide: ListSiteSettingsHandler, useValue: mockListSettings }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /public/content/site-settings', () => {
    it('returns 200 with site settings', async () => {
      mockListSettings.execute.mockResolvedValue([
        { key: 'site.title', valueText: 'My Clinic' },
      ]);

      const res = await request(app.getHttpServer())
        .get('/public/content/site-settings')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].key).toBe('site.title');
    });

    it('passes prefix filter to handler with publicOnly enforced', async () => {
      mockListSettings.execute.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/public/content/site-settings?prefix=home.')
        .expect(200);

      expect(mockListSettings.execute).toHaveBeenCalledWith({
        prefix: 'home.',
        publicOnly: true,
      });
    });

    it('always requests publicOnly even without a prefix', async () => {
      mockListSettings.execute.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/public/content/site-settings')
        .expect(200);

      expect(mockListSettings.execute).toHaveBeenCalledWith({
        prefix: undefined,
        publicOnly: true,
      });
    });
  });
});
