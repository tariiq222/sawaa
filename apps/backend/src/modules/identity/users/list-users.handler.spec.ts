import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListUsersHandler } from './list-users.handler';

describe('ListUsersHandler', () => {
  let handler: ListUsersHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListUsersHandler,
        { provide: PrismaService, useValue: {
    user: { findMany: jest.fn(), count: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<ListUsersHandler>(ListUsersHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({isActive:true,search:"test",page:1,limit:10});
    expect(result).toBeDefined();
  });
});
