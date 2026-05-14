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
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /public/metrics', () => {
    it('returns 200 with prometheus metrics', async () => {
      mockAppMetrics.registry.metrics.mockResolvedValue('# app metrics');
      mockDbMetrics.registry.metrics.mockResolvedValue('# db metrics');

      const res = await request(app.getHttpServer())
        .get('/public/metrics')
        .expect(200);

      expect(res.text).toContain('# app metrics');
      expect(res.text).toContain('# db metrics');
      expect(res.headers['content-type']).toContain('text/plain');
    });
  });
});
