import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { RemoveRoleHandler } from './remove-role.handler';

/**
 * remove-role is rank-gated: an actor must not be able to strip a custom role
 * from a user at or above their own rank. The handler looks up the actor and
 * the target's current built-in role and enforces the same gate as
 * UpdateUserRoleHandler (actorRank <= targetRank → ForbiddenException) BEFORE
 * issuing the updateMany.
 */
describe('RemoveRoleHandler', () => {
  let handler: RemoveRoleHandler;
  let prisma: { user: { updateMany: jest.Mock; findUnique: jest.Mock } };

  const ACTOR_ID = '00000000-0000-0000-0000-0000000000aa';
  const TARGET_ID = '00000000-0000-0000-0000-000000000001';
  const ROLE_ID = '00000000-0000-0000-0000-000000000010';

  /**
   * Wire the two findUnique lookups the handler performs: the first call
   * resolves the actor (by actorUserId), the second resolves the target user
   * (by userId). Pass null for either to simulate "not found".
   */
  function mockLookups(
    actor: { role: string; isSuperAdmin: boolean } | null,
    target: { role: string } | null,
  ) {
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === ACTOR_ID) return Promise.resolve(actor);
      if (where.id === TARGET_ID) return Promise.resolve(target);
      return Promise.resolve(null);
    });
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoveRoleHandler,
        {
          provide: PrismaService,
          useValue: { user: { updateMany: jest.fn(), findUnique: jest.fn() } },
        },
      ],
    }).compile();

    handler = module.get<RemoveRoleHandler>(RemoveRoleHandler);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  it('resolves when a higher-ranked actor removes the role (count=1)', async () => {
    // ADMIN (80) removing from an EMPLOYEE (30) → allowed.
    mockLookups({ role: 'ADMIN', isSuperAdmin: false }, { role: 'EMPLOYEE' });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, customRoleId: ROLE_ID }),
    ).resolves.toBeUndefined();
  });

  it('passes both ids into the where clause and sets customRoleId: null', async () => {
    mockLookups({ role: 'ADMIN', isSuperAdmin: false }, { role: 'EMPLOYEE' });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    await handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, customRoleId: ROLE_ID });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: TARGET_ID, customRoleId: ROLE_ID },
      data: { customRoleId: null },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundException when no row was updated (count=0)', async () => {
    mockLookups({ role: 'ADMIN', isSuperAdmin: false }, { role: 'EMPLOYEE' });
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, customRoleId: ROLE_ID }),
    ).rejects.toThrow(NotFoundException);
  });

  it('propagates Prisma errors when updateMany rejects', async () => {
    mockLookups({ role: 'ADMIN', isSuperAdmin: false }, { role: 'EMPLOYEE' });
    prisma.user.updateMany.mockRejectedValue(new Error('DB down'));
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, customRoleId: ROLE_ID }),
    ).rejects.toThrow('DB down');
  });

  // ─── Rank gate ───────────────────────────────────────────────────────────
  it('throws ForbiddenException when the actor outranks no one (RECEPTIONIST vs ADMIN)', async () => {
    // RECEPTIONIST (40) trying to strip a role from an ADMIN (80) → forbidden.
    mockLookups({ role: 'RECEPTIONIST', isSuperAdmin: false }, { role: 'ADMIN' });
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, customRoleId: ROLE_ID }),
    ).rejects.toThrow(ForbiddenException);
    // The gate must short-circuit before any mutation.
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException on EQUAL rank (ADMIN vs ADMIN — horizontal escalation)', async () => {
    mockLookups({ role: 'ADMIN', isSuperAdmin: false }, { role: 'ADMIN' });
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, customRoleId: ROLE_ID }),
    ).rejects.toThrow('Cannot modify a user at or above your rank');
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('lets a super admin (lifted to rank 100) remove a role from an ADMIN', async () => {
    mockLookups({ role: 'ADMIN', isSuperAdmin: true }, { role: 'ADMIN' });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, customRoleId: ROLE_ID }),
    ).resolves.toBeUndefined();
    expect(prisma.user.updateMany).toHaveBeenCalledTimes(1);
  });

  it('throws ForbiddenException when the actor is not found', async () => {
    mockLookups(null, { role: 'EMPLOYEE' });
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, customRoleId: ROLE_ID }),
    ).rejects.toThrow('Actor not found');
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the target user is not found', async () => {
    mockLookups({ role: 'ADMIN', isSuperAdmin: false }, null);
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, customRoleId: ROLE_ID }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});
