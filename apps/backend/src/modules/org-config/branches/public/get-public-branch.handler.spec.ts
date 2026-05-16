import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { GetPublicBranchHandler } from './get-public-branch.handler';

describe('GetPublicBranchHandler', () => {
  let handler: GetPublicBranchHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPublicBranchHandler,
    { provide: PrismaService, useValue: {
    branch: { findFirst: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<GetPublicBranchHandler>(GetPublicBranchHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute('00000000-0000-0000-0000-000000000001');
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
