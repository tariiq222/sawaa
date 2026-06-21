import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { ProgramCapacityService } from './program-capacity.service';

describe('ProgramCapacityService — decrementEnrollment', () => {
  let service: ProgramCapacityService;
  let tx: any;

  beforeEach(async () => {
    tx = {
      program: {
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgramCapacityService,
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

    service = module.get<ProgramCapacityService>(ProgramCapacityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('decrements enrolledCount with a > 0 guard for the given program', async () => {
    tx.program.updateMany.mockResolvedValue({ count: 1 });

    await service.decrementEnrollment(tx, 'prog-1');

    expect(tx.program.updateMany).toHaveBeenCalledWith({
      where: { id: 'prog-1', enrolledCount: { gt: 0 } },
      data: { enrolledCount: { decrement: 1 } },
    });
  });

  it('targets only the supplied programId', async () => {
    tx.program.updateMany.mockResolvedValue({ count: 0 });

    await service.decrementEnrollment(tx, 'prog-specific-id');

    expect(tx.program.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'prog-specific-id' }),
      }),
    );
  });

  it('does not throw when the program has no participants (guarded update matches nothing)', async () => {
    tx.program.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.decrementEnrollment(tx, 'prog-empty')).resolves.toBeUndefined();
  });

  it('decrementEnrollmentStandalone opens a transaction and decrements', async () => {
    tx.program.updateMany.mockResolvedValue({ count: 1 });

    await service.decrementEnrollmentStandalone('prog-2');

    expect(tx.program.updateMany).toHaveBeenCalledWith({
      where: { id: 'prog-2', enrolledCount: { gt: 0 } },
      data: { enrolledCount: { decrement: 1 } },
    });
  });
});
