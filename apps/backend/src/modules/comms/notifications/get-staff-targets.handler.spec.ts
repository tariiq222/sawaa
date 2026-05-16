import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { GetStaffTargetsHandler } from './get-staff-targets.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetStaffTargetsHandler', () => {
  let handler: GetStaffTargetsHandler;
  let prisma: { user: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { user: { findMany: jest.fn() } };

    const module = await Test.createTestingModule({
      providers: [
        GetStaffTargetsHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(GetStaffTargetsHandler);
  });

  it('filters out invalid roles and returns users', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', role: UserRole.ADMIN },
    ]);
    const result = await handler.execute({ organizationId: 'org-1', roles: [UserRole.ADMIN, 'INVALID'] });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: { in: [UserRole.ADMIN] } }),
      }),
    );
    expect(result).toEqual([{ userId: 'u1', role: UserRole.ADMIN }]);
  });

  it('includes includeUserId when not already in list', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', role: UserRole.ADMIN }]);
    const result = await handler.execute({
      organizationId: 'org-1',
      roles: [UserRole.ADMIN],
      includeUserId: 'u2',
    });
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ userId: 'u2', role: 'EMPLOYEE' });
  });

  it('does not duplicate includeUserId if already present', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', role: UserRole.ADMIN }]);
    const result = await handler.execute({
      organizationId: 'org-1',
      roles: [UserRole.ADMIN],
      includeUserId: 'u1',
    });
    expect(result).toHaveLength(1);
  });

  it('returns empty array when no valid roles', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    const result = await handler.execute({ organizationId: 'org-1', roles: ['INVALID'] });
    expect(result).toEqual([]);
  });
});
