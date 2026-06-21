import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { GroupSessionCapacityService } from './group-session-capacity.service';

describe('GroupSessionCapacityService — recalculateGroupStatus', () => {
  let service: GroupSessionCapacityService;
  let tx: any;

  beforeEach(async () => {
    tx = {
      groupSession: {
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupSessionCapacityService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: RlsTransactionService,
          useValue: {
            withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
          },
        },
      ],
    }).compile();

    service = module.get<GroupSessionCapacityService>(GroupSessionCapacityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('decrements enrolledCount with a > 0 guard for the given group session', async () => {
    tx.groupSession.updateMany.mockResolvedValue({ count: 1 });

    await service.recalculateGroupStatus(tx, 'gs-1');

    expect(tx.groupSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'gs-1', enrolledCount: { gt: 0 } },
      data: { enrolledCount: { decrement: 1 } },
    });
  });

  it('targets only the supplied groupSessionId', async () => {
    tx.groupSession.updateMany.mockResolvedValue({ count: 0 });

    await service.recalculateGroupStatus(tx, 'gs-specific-id');

    expect(tx.groupSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'gs-specific-id' }),
      }),
    );
  });

  it('does not throw when the session has no participants (guarded update matches nothing)', async () => {
    tx.groupSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.recalculateGroupStatus(tx, 'gs-empty')).resolves.toBeUndefined();
  });

  it('recalculateGroupStatusStandalone opens a transaction and decrements', async () => {
    tx.groupSession.updateMany.mockResolvedValue({ count: 1 });

    await service.recalculateGroupStatusStandalone('gs-2');

    expect(tx.groupSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'gs-2', enrolledCount: { gt: 0 } },
      data: { enrolledCount: { decrement: 1 } },
    });
  });
});
