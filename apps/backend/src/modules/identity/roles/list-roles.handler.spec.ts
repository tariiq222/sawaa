import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListRolesHandler } from './list-roles.handler';

describe('ListRolesHandler', () => {
  let handler: ListRolesHandler;
  let prisma: { customRole: { findMany: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListRolesHandler,
        { provide: PrismaService, useValue: { customRole: { findMany: jest.fn() } } },
      ],
    }).compile();
    handler = module.get<ListRolesHandler>(ListRolesHandler);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  it('passes `include: { permissions: true }` so consumers can read role permissions', async () => {
    prisma.customRole.findMany.mockResolvedValue([]);
    await handler.execute();
    expect(prisma.customRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { permissions: true } }),
    );
  });

  it('orders by isSystem desc, then createdAt asc (system roles first, oldest first within)', async () => {
    prisma.customRole.findMany.mockResolvedValue([]);
    await handler.execute();
    expect(prisma.customRole.findMany).toHaveBeenCalledWith({
      include: { permissions: true },
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });
  });

  it('returns the prisma rows verbatim (no transformation, no pagination)', async () => {
    const rows = [
      { id: 'r1', name: 'Owner', isSystem: true, permissions: [] },
      { id: 'r2', name: 'Receptionist', isSystem: false, permissions: [{ action: 'read', subject: 'User' }] },
    ];
    prisma.customRole.findMany.mockResolvedValue(rows);
    await expect(handler.execute()).resolves.toEqual(rows);
  });

  it('propagates Prisma errors when findMany rejects', async () => {
    prisma.customRole.findMany.mockRejectedValue(new Error('DB down'));
    await expect(handler.execute()).rejects.toThrow('DB down');
  });

  it('does not apply any where filter (returns every role in the system)', async () => {
    prisma.customRole.findMany.mockResolvedValue([]);
    await handler.execute();
    const call = prisma.customRole.findMany.mock.calls[0][0];
    expect(call.where).toBeUndefined();
    expect(call.skip).toBeUndefined();
    expect(call.take).toBeUndefined();
  });
});
