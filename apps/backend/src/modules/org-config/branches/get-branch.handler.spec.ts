import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetBranchHandler } from './get-branch.handler';

describe('GetBranchHandler', () => {
  let handler: GetBranchHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetBranchHandler,
        { provide: PrismaService, useValue: {
    branch: { findFirst: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetBranchHandler>(GetBranchHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({branchId:"00000000-0000-0000-0000-000000000001"});
    expect(result).toBeDefined();
    
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({branchId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
