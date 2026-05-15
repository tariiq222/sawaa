import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetUserHandler } from './get-user.handler';

describe('GetUserHandler', () => {
  let handler: GetUserHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUserHandler,
        { provide: PrismaService, useValue: {
    user: { findUnique: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetUserHandler>(GetUserHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({userId:"00000000-0000-0000-0000-000000000001"});
    expect(result).toBeDefined();
    
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({userId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
