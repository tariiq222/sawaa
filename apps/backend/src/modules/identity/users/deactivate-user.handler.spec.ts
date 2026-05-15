import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { DeactivateUserHandler } from './deactivate-user.handler';

describe('DeactivateUserHandler', () => {
  let handler: DeactivateUserHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeactivateUserHandler,
        { provide: PrismaService, useValue: {
    user: { findUnique: jest.fn(), update: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<DeactivateUserHandler>(DeactivateUserHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({userId:"00000000-0000-0000-0000-000000000001"});
    
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({userId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
