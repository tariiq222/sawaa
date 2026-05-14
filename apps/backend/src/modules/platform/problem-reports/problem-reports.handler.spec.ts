import { Test } from '@nestjs/testing';
import { CreateProblemReportHandler } from './create-problem-report.handler';
import { ListProblemReportsHandler } from './list-problem-reports.handler';
import { UpdateProblemReportStatusHandler } from './update-problem-report-status.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

const tenantProvider = {
  provide: TenantContextService,
  useValue: { requireOrganizationIdOrDefault: jest.fn().mockReturnValue('org-A') },
};

describe('ProblemReport handlers', () => {
  let create: CreateProblemReportHandler;
  let list: ListProblemReportsHandler;
  let updateStatus: UpdateProblemReportStatusHandler;
  let prisma: { problemReport: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateProblemReportHandler,
        ListProblemReportsHandler,
        UpdateProblemReportStatusHandler,
        {
          provide: PrismaService,
          useValue: {
            problemReport: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
          },
        },
        tenantProvider,
      ],
    }).compile();

    create = module.get(CreateProblemReportHandler);
    list = module.get(ListProblemReportsHandler);
    updateStatus = module.get(UpdateProblemReportStatusHandler);
    prisma = module.get(PrismaService);
  });

  it('creates a problem report', async () => {
    prisma.problemReport.create.mockResolvedValue({ id: 'pr-1' });
    const result = await create.execute({
      reporterId: 'user-1',
      type: 'BUG' as never,
      title: 'Bug',
      description: 'Something broken here',
    });
    expect(result.id).toBe('pr-1');
  });

  it('lists problem reports with pagination', async () => {
    prisma.problemReport.findMany.mockResolvedValue([{ id: 'pr-1' }]);
    prisma.problemReport.count.mockResolvedValue(1);
    const result = await list.execute({ page: 1, limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('updates problem report status', async () => {
    prisma.problemReport.update.mockResolvedValue({ id: 'pr-1', status: 'RESOLVED' });
    const result = await updateStatus.execute({ id: 'pr-1', status: 'RESOLVED' as never, resolution: 'Fixed' });
    expect(result.status).toBe('RESOLVED');
  });
});
