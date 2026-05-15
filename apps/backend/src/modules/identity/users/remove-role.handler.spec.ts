import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { RemoveRoleHandler } from './remove-role.handler';

describe('RemoveRoleHandler', () => {
  let handler: RemoveRoleHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoveRoleHandler,
        { provide: PrismaService, useValue: {
    user: { updateMany: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<RemoveRoleHandler>(RemoveRoleHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.user.updateMany as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({userId:"00000000-0000-0000-0000-000000000001",customRoleId:"00000000-0000-0000-0000-000000000001"});
    
    (prisma.user.updateMany as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({userId:"00000000-0000-0000-0000-000000000001",customRoleId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
