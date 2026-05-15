import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { CreateRoleHandler } from './create-role.handler';

describe('CreateRoleHandler', () => {
  let handler: CreateRoleHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateRoleHandler,
        { provide: PrismaService, useValue: {
          customRole: { findFirst: jest.fn(), create: jest.fn() },
        } },
      ],
    }).compile();

    handler = module.get<CreateRoleHandler>(CreateRoleHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should create role when not existing', async () => {
    (prisma.customRole.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.customRole.create as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({ name: 'Test' });
    expect(prisma.customRole.create).toHaveBeenCalled();
  });

  it('should throw when role exists', async () => {
    (prisma.customRole.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });
    await expect(handler.execute({ name: 'Test' })).rejects.toThrow();
  });
});
