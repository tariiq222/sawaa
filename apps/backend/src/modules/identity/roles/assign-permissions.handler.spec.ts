import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { AssignPermissionsHandler } from './assign-permissions.handler';

describe('AssignPermissionsHandler', () => {
  let handler: AssignPermissionsHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignPermissionsHandler,
        { provide: PrismaService, useValue: {
          customRole: { findFirst: jest.fn() },
          permission: { deleteMany: jest.fn(), createMany: jest.fn() },
        } },
      ],
    }).compile();

    handler = module.get<AssignPermissionsHandler>(AssignPermissionsHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should assign permissions', async () => {
    (prisma.customRole.findFirst as jest.Mock).mockResolvedValue({ id: 'role' });
    (prisma.permission.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.permission.createMany as jest.Mock).mockResolvedValue({ count: 1 });
    await handler.execute({ customRoleId: 'role', permissions: [{ action: 'read', subject: 'User' }] });
    expect(prisma.permission.createMany).toHaveBeenCalled();
  });

  it('should throw when role not found', async () => {
    (prisma.customRole.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({ customRoleId: 'role', permissions: [] })).rejects.toThrow();
  });
});
