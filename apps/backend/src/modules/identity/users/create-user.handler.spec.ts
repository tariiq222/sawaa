import { CreateUserHandler } from './create-user.handler';
import { ConflictException } from '@nestjs/common';

describe('CreateUserHandler', () => {
  let handler: CreateUserHandler;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock }; $transaction: jest.Mock };
  let password: { hash: jest.Mock };
  // The actor lookup is by { id }; the email-uniqueness lookup is by { email }.
  // Default actor is a SUPER_ADMIN so it passes the rank gate.
  let actor: { role: string; isSuperAdmin: boolean } | null;
  let existingByEmail: { id: string } | null;

  beforeEach(() => {
    actor = { role: 'SUPER_ADMIN', isSuperAdmin: true };
    existingByEmail = null;
    prisma = {
      user: {
        findUnique: jest.fn(({ where }: { where: { id?: string; email?: string } }) =>
          Promise.resolve(where.id ? actor : existingByEmail),
        ),
        create: jest.fn().mockResolvedValue({ id: 'u1' }),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };
    password = { hash: jest.fn().mockResolvedValue('hashed') };
    const rlsTransaction = { withTransaction: jest.fn((fn: any) => fn(prisma)) };
    handler = new CreateUserHandler(prisma as any, rlsTransaction as any, password as any);
  });

  it('creates user when email is unique', async () => {
    const result = await handler.execute({
      actorUserId: 'actor-1',
      email: 'test@example.com',
      password: 'secret',
      name: 'Test',
      role: 'ADMIN',
    } as any);
    expect(result.id).toBe('u1');
    expect(password.hash).toHaveBeenCalledWith('secret');
  });

  it('throws when email already registered', async () => {
    existingByEmail = { id: 'existing' };
    await expect(
      handler.execute({ actorUserId: 'actor-1', email: 'test@example.com', password: 'secret', role: 'ADMIN' } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when the actor cannot grant a role at or above their own rank', async () => {
    actor = { role: 'ADMIN', isSuperAdmin: false };
    await expect(
      handler.execute({ actorUserId: 'actor-1', email: 'x@example.com', password: 'secret', name: 'X', role: 'ADMIN' } as any),
    ).rejects.toThrow('Cannot assign a role at or above your rank');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects when the actor cannot be found', async () => {
    actor = null;
    await expect(
      handler.execute({ actorUserId: 'ghost', email: 'x@example.com', password: 'secret', name: 'X', role: 'RECEPTIONIST' } as any),
    ).rejects.toThrow('Actor not found');
  });
});
