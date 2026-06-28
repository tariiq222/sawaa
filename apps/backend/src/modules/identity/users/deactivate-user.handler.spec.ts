import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { DeactivateUserHandler } from './deactivate-user.handler';

const ACTOR_ID = '00000000-0000-0000-0000-0000000000aa';
const TARGET_ID = '00000000-0000-0000-0000-0000000000bb';

describe('DeactivateUserHandler', () => {
  let handler: DeactivateUserHandler;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeactivateUserHandler,
        {
          provide: PrismaService,
          useValue: { user: { findUnique: jest.fn(), update: jest.fn() } },
        },
      ],
    }).compile();

    handler = module.get<DeactivateUserHandler>(DeactivateUserHandler);
    prisma = module.get<PrismaService>(PrismaService) as any;
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

  it('deactivates when a higher-rank actor targets a lower-rank user', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      { id: TARGET_ID, role: 'RECEPTIONIST', isSuperAdmin: false },
    );
    prisma.user.update.mockResolvedValue({ id: TARGET_ID, isActive: false });

    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID }),
    ).resolves.toBeUndefined();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: { isActive: false },
    });
  });

  it('rejects (403) when a lower-rank actor targets a higher-rank user', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'RECEPTIONIST', isSuperAdmin: false },
      { id: TARGET_ID, role: 'ADMIN', isSuperAdmin: false },
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects (403) when actor and target are at equal rank', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      { id: TARGET_ID, role: 'ADMIN', isSuperAdmin: false },
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects (403) when an ADMIN targets a SUPER_ADMIN', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      { id: TARGET_ID, role: 'ADMIN', isSuperAdmin: true },
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects (403) self-deactivation even for a SUPER_ADMIN', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: true },
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: true },
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: ACTOR_ID }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException and does NOT update when the target does not exist', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      null,
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: 'ghost' }),
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

  it('propagates Prisma errors when update rejects', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      { id: TARGET_ID, role: 'RECEPTIONIST', isSuperAdmin: false },
    );
    prisma.user.update.mockRejectedValue(new Error('DB down'));
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID }),
    ).rejects.toThrow('DB down');
  });
});
