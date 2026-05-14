import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardOpsController } from './ops.controller';
import { GenerateReportHandler } from '../../modules/ops/generate-report/generate-report.handler';
import { ListActivityHandler } from '../../modules/ops/log-activity/list-activity.handler';
import { TenantContextService } from '../../common/tenant';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardOpsController (e2e)', () => {
  let app: INestApplication;

  const mockGenerateReport = { execute: jest.fn() };
  const mockListActivity = { execute: jest.fn() };
  const mockTenant = { requireOrganizationIdOrDefault: jest.fn().mockReturnValue('00000000-0000-4000-a000-000000000001') };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardOpsController],
      providers: [
        { provide: GenerateReportHandler, useValue: mockGenerateReport },
        { provide: ListActivityHandler, useValue: mockListActivity },
        { provide: TenantContextService, useValue: mockTenant },
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

  describe('POST /dashboard/ops/reports', () => {
    it('returns 200 with JSON report', async () => {
      mockGenerateReport.execute.mockResolvedValue({
        format: 'JSON',
        reportId: 'rep-1',
        data: [{ name: 'Booking', count: 10 }],
      });

      const res = await request(app.getHttpServer())
        .post('/dashboard/ops/reports')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ type: 'REVENUE', format: 'JSON', from: '2026-01-01', to: '2026-01-31' })
        .expect(200);

      expect(res.body.reportId).toBe('rep-1');
    });
  });

  describe('GET /dashboard/ops/activity', () => {
    it('returns 200 with activity log', async () => {
      mockListActivity.execute.mockResolvedValue({
        data: [{ id: 'act-1', action: 'CREATE', entity: 'Booking' }],
        total: 1,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/ops/activity')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });

    it('passes query filters to handler', async () => {
      mockListActivity.execute.mockResolvedValue({ data: [], total: 0 });

      await request(app.getHttpServer())
        .get('/dashboard/ops/activity?entity=Booking&action=CREATE')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListActivity.execute).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'Booking', action: 'CREATE' }),
      );
    });
  });
});
