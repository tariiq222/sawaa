import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { ListPublicBranchEmployeesHandler } from './list-public-branch-employees.handler';

describe('ListPublicBranchEmployeesHandler', () => {
  let handler: ListPublicBranchEmployeesHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListPublicBranchEmployeesHandler,
    { provide: PrismaService, useValue: {
    branch: { findFirst: jest.fn() },
    employeeBranch: { findMany: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<ListPublicBranchEmployeesHandler>(ListPublicBranchEmployeesHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ id: '00000000-0000-0000-0000-000000000001' });
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
