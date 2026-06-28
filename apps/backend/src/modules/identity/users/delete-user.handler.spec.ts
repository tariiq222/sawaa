import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { DeleteUserHandler } from './delete-user.handler';

const ACTOR_ID = '00000000-0000-0000-0000-0000000000aa';
const TARGET_ID = '00000000-0000-0000-0000-0000000000bb';

describe('DeleteUserHandler', () => {
  let handler: DeleteUserHandler;
  let prisma: { user: { findUnique: jest.Mock; deleteMany: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteUserHandler,
        {
          provide: PrismaService,
          useValue: { user: { findUnique: jest.fn(), deleteMany: jest.fn() } },
        },
      ],
    }).compile();

    handler = module.get<DeleteUserHandler>(DeleteUserHandler);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  function mockActorThenTarget(
    actor: { id: string; role: string; isSuperAdmin: boolean } | null,
    target: { id: string; role: string; isSuperAdmin: boolean } | null,
  ) {
    prisma.user.findUnique
      .mockResolvedValueOnce(actor as any)
      .mockResolvedValueOnce(target as any);
  }

  it('deletes when a higher-rank actor targets a lower-rank user', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      { id: TARGET_ID, role: 'RECEPTIONIST', isSuperAdmin: false },
    );
    prisma.user.deleteMany.mockResolvedValue({ count: 1 });
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID }),
    ).resolves.toBeUndefined();
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: TARGET_ID } });
  });

  it('rejects (403) when a lower-rank actor targets a higher-rank user', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'RECEPTIONIST', isSuperAdmin: false },
      { id: TARGET_ID, role: 'ADMIN', isSuperAdmin: false },
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects (403) when actor and target are at equal rank', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      { id: TARGET_ID, role: 'ADMIN', isSuperAdmin: false },
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects (403) when an ADMIN targets a SUPER_ADMIN', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      { id: TARGET_ID, role: 'ADMIN', isSuperAdmin: true },
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects (403) self-deletion even for a SUPER_ADMIN', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: true },
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: true },
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: ACTOR_ID }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the target does not exist (before deleteMany)', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      null,
    );
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: 'ghost' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when the actor does not exist', async () => {
    mockActorThenTarget(
      null,
      { id: TARGET_ID, role: 'RECEPTIONIST', isSuperAdmin: false },
    );
    await expect(
      handler.execute({ actorUserId: 'ghost', userId: TARGET_ID }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when deleteMany removed no row (count=0)', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      { id: TARGET_ID, role: 'RECEPTIONIST', isSuperAdmin: false },
    );
    prisma.user.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID }),
    ).rejects.toThrow(NotFoundException);
  });

  it('propagates a Prisma error when deleteMany itself rejects', async () => {
    mockActorThenTarget(
      { id: ACTOR_ID, role: 'ADMIN', isSuperAdmin: false },
      { id: TARGET_ID, role: 'RECEPTIONIST', isSuperAdmin: false },
    );
    prisma.user.deleteMany.mockRejectedValue(new Error('FK constraint violation'));
    await expect(
      handler.execute({ actorUserId: ACTOR_ID, userId: TARGET_ID }),
    ).rejects.toThrow('FK constraint violation');
  });
});
