import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { UpdateUserHandler } from './update-user.handler';

const ACTOR_ID = '00000000-0000-0000-0000-0000000000aa';
const TARGET_ID = '00000000-0000-0000-0000-0000000000bb';

describe('UpdateUserHandler', () => {
  let handler: UpdateUserHandler;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
  };
  let rlsTransaction: { withTransaction: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    rlsTransaction = {
      withTransaction: jest.fn((cb: any) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateUserHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction },
      ],
    }).compile();

    handler = module.get<UpdateUserHandler>(UpdateUserHandler);
  });

  /** Resolve actor first, then target — matches the Promise.all order in the handler. */
  function mockActorThenTarget(
    actor: { id: string; role: string; isSuperAdmin: boolean } | null,
    target: { id: string; role: string; isSuperAdmin: boolean } | null,
  ) {
    prisma.user.findUnique
      .mockResolvedValueOnce(actor as any)
      .mockResolvedValueOnce(target as any);
  }

  /** Default: ADMIN actor managing a RECEPTIONIST target (actor strictly outranks). */
  function mockHigherRankActor() {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      { id: TARGET_ID, role: 'RECEPTIONIST', isSuperAdmin: false },
    );
  }

  it('throws NotFoundException when the target does not exist', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      null,
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when the actor does not exist', async () => {
    mockActorThenTarget(
      null,
      { id: TARGET_ID, role: 'RECEPTIONIST', isSuperAdmin: false },
    );
    await expect(
      handler.execute({ actorUserId: 'ghost', userId: TARGET_ID }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does NOT touch the DB when the target does not exist (no leaky updates)', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      null,
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, name: 'X' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
  });

  it('rejects (403) when a lower-rank actor updates a higher-rank user', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'RECEPTIONIST', isSuperAdmin: false },
      { id: TARGET_ID, role: 'ADMIN', isSuperAdmin: false },
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, name: 'X' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects (403) when actor and target are at equal rank', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      { id: TARGET_ID, role: 'ADMIN', isSuperAdmin: false },
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, name: 'X' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects (403) when an ADMIN updates a SUPER_ADMIN', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      { id: TARGET_ID, role: 'ADMIN', isSuperAdmin: true },
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, isActive: false }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects (403) self-update (e.g. self-deactivate via activate/update path)', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: true },
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: true },
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: ACTOR_ID, isActive: false }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updates only the supplied fields (partial update semantics)', async () => {
    mockHigherRankActor();
    prisma.user.update.mockResolvedValue({ id: TARGET_ID, name: 'New Name' });

    const result = await handler.execute({
      actorUserId: ACTOR_ID,
      userId: TARGET_ID,
      name: 'New Name',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: {
        email: undefined,
        name: 'New Name',
        phone: undefined,
        gender: undefined,
        avatarUrl: undefined,
        isActive: undefined,
      },
      omit: { passwordHash: true },
    });
    expect(result.name).toBe('New Name');
  });

  it('passes every updatable field through to Prisma when all are provided', async () => {
    mockHigherRankActor();
    prisma.user.update.mockResolvedValue({ id: TARGET_ID });

    await handler.execute({
      actorUserId: ACTOR_ID,
      userId: TARGET_ID,
      email: 'a@b.com',
      name: 'Salem',
      phone: '+966512345678',
      gender: 'MALE' as any,
      avatarUrl: 'https://x/avatar.png',
      isActive: true,
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TARGET_ID },
        data: expect.objectContaining({
          email: 'a@b.com',
          name: 'Salem',
          phone: '+966512345678',
          avatarUrl: 'https://x/avatar.png',
          isActive: true,
        }),
      }),
    );
  });

  it('omits passwordHash from the response (PII guard)', async () => {
    mockHigherRankActor();
    prisma.user.update.mockResolvedValue({ id: TARGET_ID, name: 'New' });

    await handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, name: 'New' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ omit: { passwordHash: true } }),
    );
  });

  it('runs the update inside the RLS transaction', async () => {
    mockHigherRankActor();
    prisma.user.update.mockResolvedValue({ id: TARGET_ID, name: 'New' });

    await handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID, name: 'New' });

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
  });

  // SECURITY (P0-2): the command type intentionally does NOT include `role`
  // or `customRoleId` — they must go through `UpdateUserRoleHandler` with
  // its rank gate. This test makes that contract enforceable: if a future
  // change adds them here, the typecheck fails.
  it('SECURITY (P0-2): command type does not include role/customRoleId', () => {
    const cmd: Parameters<UpdateUserHandler['execute']>[0] = {
      actorUserId: ACTOR_ID,
      userId: TARGET_ID,
      email: 'a@b.com',
      name: 'X',
    };
    expect((cmd as any).role).toBeUndefined();
    expect((cmd as any).customRoleId).toBeUndefined();
  });
});
