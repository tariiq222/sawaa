import { Test, TestingModule } from '@nestjs/testing';
import { ListPlatformEmailLogsHandler } from './list-platform-email-logs.handler';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

describe('ListPlatformEmailLogsHandler', () => {
  let handler: ListPlatformEmailLogsHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      platformEmailLog: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ListPlatformEmailLogsHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<ListPlatformEmailLogsHandler>(ListPlatformEmailLogsHandler);
  });

  it('should return logs with default limit', async () => {
    prisma.platformEmailLog.findMany.mockResolvedValue([
      { id: 'log-1', status: 'SENT', templateSlug: 'welcome', toAddress: 'a@b.com', createdAt: new Date() },
    ]);

    const result = await handler.execute({});
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(prisma.platformEmailLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51 }));
  });

  it('should cap limit at 200', async () => {
    prisma.platformEmailLog.findMany.mockResolvedValue([]);
    await handler.execute({ limit: 500 });
    expect(prisma.platformEmailLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 201 }));
  });

  it('should apply all filters', async () => {
    prisma.platformEmailLog.findMany.mockResolvedValue([]);
    await handler.execute({ status: 'SENT', templateSlug: 'welcome', organizationId: 'org-1', cursor: 'log-99' });
    expect(prisma.platformEmailLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'SENT', templateSlug: 'welcome', organizationId: 'org-1', id: { lt: 'log-99' } },
    }));
  });

  it('should set nextCursor when more items exist', async () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ id: `log-${i}`, status: 'SENT' }));
    prisma.platformEmailLog.findMany.mockResolvedValue(items);

    const result = await handler.execute({ limit: 10 });
    expect(result.items).toHaveLength(10);
    expect(result.nextCursor).toBe('log-9');
  });
});
