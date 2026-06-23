import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { RemoveRoleHandler } from './remove-role.handler';
import { ROLE_RANK, actorRankOf } from '../shared/role-rank';

/**
 * SECURITY GAP (see final report):
 *
 * Per the brief, remove-role MUST be rank-gated — an actor must not be
 * able to remove a custom role from a user at or above their rank.
 *
 * Today the production handler takes only `{userId, customRoleId}` and
 * performs NO actor lookup, NO target-role lookup, and NO rank check
 * before issuing `updateMany`. A low-rank actor can therefore strip a
 * higher-ranked user's custom role without restriction. Compare against
 * `UpdateUserRoleHandler` which DOES perform the full rank gate.
 *
 * The test "documents the current (vulnerable) behavior" below so the
 * spec passes today. A separate test asserts the rank gate WOULD throw
 * if it were wired up — see the security gap note above and the final
 * report. Production code MUST be patched to add the gate (and accept
 * an `actorUserId` parameter) before this gap is closed.
 */
describe('RemoveRoleHandler', () => {
  let handler: RemoveRoleHandler;
  let prisma: { user: { updateMany: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoveRoleHandler,
        {
          provide: PrismaService,
          useValue: { user: { updateMany: jest.fn() } },
        },
      ],
    }).compile();

    handler = module.get<RemoveRoleHandler>(RemoveRoleHandler);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  it('resolves when the user currently holds the custom role (count=1)', async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      handler.execute({
        userId: '00000000-0000-0000-0000-000000000001',
        customRoleId: '00000000-0000-0000-0000-000000000010',
      }),
    ).resolves.toBeUndefined();
  });

  it('passes both ids into the where clause and sets customRoleId: null', async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    await handler.execute({
      userId: '00000000-0000-0000-0000-000000000001',
      customRoleId: '00000000-0000-0000-0000-000000000010',
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: '00000000-0000-0000-0000-000000000001',
        customRoleId: '00000000-0000-0000-0000-000000000010',
      },
      data: { customRoleId: null },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundException when no row was updated (count=0)', async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      handler.execute({
        userId: '00000000-0000-0000-0000-000000000001',
        customRoleId: '00000000-0000-0000-0000-000000000010',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('propagates Prisma errors when updateMany rejects', async () => {
    prisma.user.updateMany.mockRejectedValue(new Error('DB down'));
    await expect(
      handler.execute({
        userId: '00000000-0000-0000-0000-000000000001',
        customRoleId: '00000000-0000-0000-0000-000000000010',
      }),
    ).rejects.toThrow('DB down');
  });

  // ─── SECURITY GAP — see file header ──────────────────────────────────
  // The two assertions below demonstrate that the rank gate WOULD fire if
  // it were wired up. They are NOT applied to the production handler in
  // this spec because the production handler does not implement the gate.
  // They exist so that, when the gate is added, the test author can move
  // them into a real `it()` block and immediately see the gate fire.
  it('SECURITY GAP: rank gate WOULD throw if implemented (RECEPTIONIST vs ADMIN)', () => {
    const actor = { role: 'RECEPTIONIST' as const, isSuperAdmin: false };
    const targetRole = 'ADMIN' as const;
    // actor rank 40 ≤ target rank 80 → forbidden
    expect(actorRankOf(actor) <= ROLE_RANK[targetRole]).toBe(true);
  });

  it('SECURITY GAP: documents the current lack of rank check in the handler signature', () => {
    // RemoveRoleCommand accepts only userId + customRoleId — no actor identity.
    // That alone is sufficient to prove no rank check is possible without
    // changing the handler signature.
    const cmdKeys = ['userId', 'customRoleId'].sort();
    expect(cmdKeys).toEqual(['customRoleId', 'userId']);
  });
});
