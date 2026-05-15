import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { DeleteUserHandler } from './delete-user.handler';

describe('DeleteUserHandler', () => {
  let handler: DeleteUserHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteUserHandler,
        { provide: PrismaService, useValue: {
    user: { deleteMany: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<DeleteUserHandler>(DeleteUserHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.user.deleteMany as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({userId:"00000000-0000-0000-0000-000000000001"});
    
    (prisma.user.deleteMany as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({userId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
