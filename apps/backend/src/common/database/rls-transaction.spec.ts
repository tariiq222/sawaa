import { Test, TestingModule } from '@nestjs/testing';
import { RlsTransactionService } from './rls-transaction';
import { PrismaService } from '../../infrastructure/database';

describe('RlsTransactionService', () => {
  let service: RlsTransactionService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RlsTransactionService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn().mockImplementation((fn) => fn({})),
          },
        },
      ],
    }).compile();

    service = module.get<RlsTransactionService>(RlsTransactionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should run transaction', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const result = await service.withTransaction(fn);
    expect(result).toBe('result');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('should run transaction with options', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    await service.withTransaction(fn, { timeout: 5000, maxWait: 1000, isolationLevel: 'Serializable' });
    expect(prisma.$transaction).toHaveBeenCalledWith(fn, expect.objectContaining({ timeout: 5000 }));
  });

  it('should run bypass transaction', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const result = await service.withBypassTransaction(fn);
    expect(result).toBe('result');
  });
});
