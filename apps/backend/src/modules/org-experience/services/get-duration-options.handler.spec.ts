import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetDurationOptionsHandler } from './get-duration-options.handler';

describe('GetDurationOptionsHandler', () => {
  let handler: GetDurationOptionsHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetDurationOptionsHandler,
        { provide: PrismaService, useValue: {
    serviceDurationOption: { findMany: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetDurationOptionsHandler>(GetDurationOptionsHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('queries duration options for the service ordered by sortOrder and returns them as-is', async () => {
    const rows = [
      { id: 'opt-1', serviceId: 'svc-1', durationMins: 30, sortOrder: 0 },
      { id: 'opt-2', serviceId: 'svc-1', durationMins: 60, sortOrder: 1 },
    ];
    (prisma.serviceDurationOption.findMany as jest.Mock).mockResolvedValue(rows);

    const result = await handler.execute({ serviceId: 'svc-1' });

    expect(prisma.serviceDurationOption.findMany).toHaveBeenCalledWith({
      where: { serviceId: 'svc-1' },
      orderBy: { sortOrder: 'asc' },
    });
    expect(result).toBe(rows);
  });
});
