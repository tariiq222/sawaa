import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListRolesHandler } from './list-roles.handler';

describe('ListRolesHandler', () => {
  let handler: ListRolesHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListRolesHandler,
        { provide: PrismaService, useValue: {
    customRole: { findMany: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<ListRolesHandler>(ListRolesHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.customRole.findMany as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute();
    expect(result).toBeDefined();
  });
});
