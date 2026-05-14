import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardIntegrationsController } from './integrations.controller';
import { GetZoomConfigHandler } from '../../modules/integrations/zoom/get-zoom-config.handler';
import { UpsertZoomConfigHandler } from '../../modules/integrations/zoom/upsert-zoom-config.handler';
import { TestZoomConfigHandler } from '../../modules/integrations/zoom/test-zoom-config.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardIntegrationsController (e2e)', () => {
  let app: INestApplication;

  const mockGetZoom = { execute: jest.fn() };
  const mockUpsertZoom = { execute: jest.fn() };
  const mockTestZoom = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardIntegrationsController],
      providers: [
        { provide: GetZoomConfigHandler, useValue: mockGetZoom },
        { provide: UpsertZoomConfigHandler, useValue: mockUpsertZoom },
        { provide: TestZoomConfigHandler, useValue: mockTestZoom },
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

  const validZoomConfig = {
    zoomClientId: 'client-id-123',
    zoomClientSecret: 'secret-456',
    zoomAccountId: 'account-789',
  };

  describe('GET /dashboard/integrations/zoom', () => {
    it('returns 200 with zoom config', async () => {
      mockGetZoom.execute.mockResolvedValue({ configured: true, isActive: true });

      const res = await request(app.getHttpServer())
        .get('/dashboard/integrations/zoom')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.configured).toBe(true);
      expect(mockGetZoom.execute).toHaveBeenCalled();
    });
  });

  describe('PUT /dashboard/integrations/zoom', () => {
    it('returns 200 on valid upsert', async () => {
      mockUpsertZoom.execute.mockResolvedValue({ configured: true, isActive: true });

      const res = await request(app.getHttpServer())
        .put('/dashboard/integrations/zoom')
        .set('Authorization', 'Bearer fake-jwt')
        .send(validZoomConfig)
        .expect(200);

      expect(res.body.configured).toBe(true);
      expect(mockUpsertZoom.execute).toHaveBeenCalledWith(validZoomConfig);
    });

    it('returns 400 for missing zoomClientId', async () => {
      return request(app.getHttpServer())
        .put('/dashboard/integrations/zoom')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ zoomClientSecret: 's', zoomAccountId: 'a' })
        .expect(400);
    });

    it('returns 400 for empty zoomClientSecret', async () => {
      return request(app.getHttpServer())
        .put('/dashboard/integrations/zoom')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validZoomConfig, zoomClientSecret: '' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .put('/dashboard/integrations/zoom')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validZoomConfig, extra: 'bad' })
        .expect(400);
    });
  });

  describe('POST /dashboard/integrations/zoom/test', () => {
    it('returns 200 on successful test', async () => {
      mockTestZoom.execute.mockResolvedValue({ ok: true });

      const res = await request(app.getHttpServer())
        .post('/dashboard/integrations/zoom/test')
        .set('Authorization', 'Bearer fake-jwt')
        .send(validZoomConfig)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(mockTestZoom.execute).toHaveBeenCalledWith(validZoomConfig);
    });

    it('returns 200 on failed test', async () => {
      mockTestZoom.execute.mockResolvedValue({ ok: false, error: 'Invalid credentials' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/integrations/zoom/test')
        .set('Authorization', 'Bearer fake-jwt')
        .send(validZoomConfig)
        .expect(200);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('Invalid credentials');
    });
  });
});
