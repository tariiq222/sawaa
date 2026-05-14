import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PublicHealthController } from './health.controller';
import { HealthCheckHandler } from '../../modules/ops/health-check/health-check.handler';

describe('PublicHealthController (e2e)', () => {
  let app: INestApplication;

  const mockHealthCheck = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicHealthController],
      providers: [{ provide: HealthCheckHandler, useValue: mockHealthCheck }],
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

  describe('GET /health/live', () => {
    it('returns 200 with ok status', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('returns 200 when healthy', async () => {
      mockHealthCheck.execute.mockResolvedValue({ status: 'ok', db: 'ok', redis: 'ok', queue: 'ok' });

      const res = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.db).toBe('ok');
    });
  });

  describe('GET /health', () => {
    it('returns 200 with health check result', async () => {
      mockHealthCheck.execute.mockResolvedValue({ status: 'ok', db: 'ok', redis: 'ok', queue: 'ok' });

      const res = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
    });
  });
});
