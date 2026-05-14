import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardPlatformController } from './platform.controller';
import { CreateProblemReportHandler } from '../../modules/platform/problem-reports/create-problem-report.handler';
import { ListProblemReportsHandler } from '../../modules/platform/problem-reports/list-problem-reports.handler';
import { UpdateProblemReportStatusHandler } from '../../modules/platform/problem-reports/update-problem-report-status.handler';
import { UpsertIntegrationHandler } from '../../modules/platform/integrations/upsert-integration.handler';
import { ListIntegrationsHandler } from '../../modules/platform/integrations/list-integrations.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardPlatformController (e2e)', () => {
  let app: INestApplication;

  const mockCreateReport = { execute: jest.fn() };
  const mockListReports = { execute: jest.fn() };
  const mockUpdateReport = { execute: jest.fn() };
  const mockUpsertIntegration = { execute: jest.fn() };
  const mockListIntegrations = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardPlatformController],
      providers: [
        { provide: CreateProblemReportHandler, useValue: mockCreateReport },
        { provide: ListProblemReportsHandler, useValue: mockListReports },
        { provide: UpdateProblemReportStatusHandler, useValue: mockUpdateReport },
        { provide: UpsertIntegrationHandler, useValue: mockUpsertIntegration },
        { provide: ListIntegrationsHandler, useValue: mockListIntegrations },
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

  const reportId = '00000000-0000-4000-a000-000000000001';

  describe('POST /dashboard/platform/problem-reports', () => {
    it('returns 201 on valid create', async () => {
      mockCreateReport.execute.mockResolvedValue({ id: reportId, title: 'Bug report' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/platform/problem-reports')
        .set('Authorization', 'Bearer fake-jwt')
        .send({
          reporterId: '00000000-0000-4000-a000-000000000002',
          type: 'BUG',
          title: 'Booking page crashes',
          description: 'When clicking confirm, the page throws a 500 error.',
        })
        .expect(201);

      expect(res.body.title).toBe('Bug report');
    });

    it('returns 400 for missing title', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/platform/problem-reports')
        .set('Authorization', 'Bearer fake-jwt')
        .send({
          reporterId: '00000000-0000-4000-a000-000000000002',
          type: 'BUG',
          description: 'When clicking confirm, the page throws a 500 error.',
        })
        .expect(400);
    });

    it('returns 400 for short description', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/platform/problem-reports')
        .set('Authorization', 'Bearer fake-jwt')
        .send({
          reporterId: '00000000-0000-4000-a000-000000000002',
          type: 'BUG',
          title: 'Bug',
          description: 'short',
        })
        .expect(400);
    });

    it('returns 400 for invalid type', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/platform/problem-reports')
        .set('Authorization', 'Bearer fake-jwt')
        .send({
          reporterId: '00000000-0000-4000-a000-000000000002',
          type: 'INVALID_TYPE',
          title: 'Bug report',
          description: 'When clicking confirm, the page throws a 500 error.',
        })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/platform/problem-reports')
        .set('Authorization', 'Bearer fake-jwt')
        .send({
          reporterId: '00000000-0000-4000-a000-000000000002',
          type: 'BUG',
          title: 'Bug report',
          description: 'When clicking confirm, the page throws a 500 error.',
          extra: 'bad',
        })
        .expect(400);
    });
  });

  describe('GET /dashboard/platform/problem-reports', () => {
    it('returns 200 with paginated reports', async () => {
      mockListReports.execute.mockResolvedValue({
        data: [{ id: reportId, title: 'Bug report' }],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/platform/problem-reports')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });

    it('passes status filter', async () => {
      mockListReports.execute.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });

      await request(app.getHttpServer())
        .get('/dashboard/platform/problem-reports?status=OPEN&page=1&limit=10')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListReports.execute).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'OPEN' }),
      );
    });

    it('returns 400 for invalid status', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/platform/problem-reports?status=INVALID')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('PATCH /dashboard/platform/problem-reports/:id/status', () => {
    it('returns 200 on status update', async () => {
      mockUpdateReport.execute.mockResolvedValue({ id: reportId, status: 'RESOLVED' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/platform/problem-reports/${reportId}/status`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ status: 'RESOLVED', resolution: 'Fixed in v1.4.2' })
        .expect(200);

      expect(res.body.status).toBe('RESOLVED');
      expect(mockUpdateReport.execute).toHaveBeenCalledWith({
        id: reportId,
        status: 'RESOLVED',
        resolution: 'Fixed in v1.4.2',
      });
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .patch('/dashboard/platform/problem-reports/not-a-uuid/status')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ status: 'RESOLVED' })
        .expect(400);
    });

    it('returns 400 for missing status', async () => {
      return request(app.getHttpServer())
        .patch(`/dashboard/platform/problem-reports/${reportId}/status`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(400);
    });
  });

  describe('POST /dashboard/platform/integrations', () => {
    it('returns 200 on valid upsert', async () => {
      mockUpsertIntegration.execute.mockResolvedValue({ provider: 'MOYASAR', isActive: true });

      const res = await request(app.getHttpServer())
        .post('/dashboard/platform/integrations')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ provider: 'MOYASAR', config: { apiKey: 'sk_test_123' }, isActive: true })
        .expect(200);

      expect(res.body.provider).toBe('MOYASAR');
    });

    it('returns 400 for missing provider', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/platform/integrations')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ config: {} })
        .expect(400);
    });

    it('returns 400 for non-object config', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/platform/integrations')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ provider: 'MOYASAR', config: 'string' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/platform/integrations')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ provider: 'MOYASAR', config: {}, extra: 'bad' })
        .expect(400);
    });
  });

  describe('GET /dashboard/platform/integrations', () => {
    it('returns 200 with integrations list', async () => {
      mockListIntegrations.execute.mockResolvedValue([
        { provider: 'MOYASAR', isActive: true },
        { provider: 'ZOOM', isActive: false },
      ]);

      const res = await request(app.getHttpServer())
        .get('/dashboard/platform/integrations')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(2);
    });
  });
});
