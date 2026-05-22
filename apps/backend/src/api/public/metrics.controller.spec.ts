import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PublicMetricsController } from './metrics.controller';
import { AppMetricsService } from '../../infrastructure/telemetry/app-metrics.service';
import { DbMetricsService } from '../../infrastructure/telemetry/db-metrics.service';

describe('PublicMetricsController (e2e)', () => {
  let app: INestApplication;

  const mockAppMetrics = { registry: { metrics: jest.fn() } };
  const mockDbMetrics = { registry: { metrics: jest.fn() } };

  const OLD_ENV = process.env;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicMetricsController],
      providers: [
        { provide: AppMetricsService, useValue: mockAppMetrics },
        { provide: DbMetricsService, useValue: mockDbMetrics },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    process.env = OLD_ENV;
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /public/metrics', () => {
    it('returns 503 when METRICS_TOKEN is not configured (P0-13 fail-closed)', async () => {
      delete process.env['METRICS_TOKEN'];
      await request(app.getHttpServer()).get('/public/metrics').expect(503);
    });

    it('returns 401 with wrong token (P0-13)', async () => {
      process.env['METRICS_TOKEN'] = 'correct-horse-battery-staple-32-chars';
      await request(app.getHttpServer())
        .get('/public/metrics')
        .set('Authorization', 'Bearer wrong-token')
        .expect(401);
    });

    it('returns 401 with no Authorization header', async () => {
      process.env['METRICS_TOKEN'] = 'correct-horse-battery-staple-32-chars';
      await request(app.getHttpServer()).get('/public/metrics').expect(401);
    });

    it('returns 200 with prometheus metrics when token matches', async () => {
      process.env['METRICS_TOKEN'] = 'correct-horse-battery-staple-32-chars';
      mockAppMetrics.registry.metrics.mockResolvedValue('# app metrics');
      mockDbMetrics.registry.metrics.mockResolvedValue('# db metrics');

      const res = await request(app.getHttpServer())
        .get('/public/metrics')
        .set('Authorization', 'Bearer correct-horse-battery-staple-32-chars')
        .expect(200);

      expect(res.text).toContain('# app metrics');
      expect(res.text).toContain('# db metrics');
      expect(res.headers['content-type']).toContain('text/plain');
    });
  });
});
