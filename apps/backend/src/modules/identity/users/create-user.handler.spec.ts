import { CreateUserHandler } from './create-user.handler';
import { ConflictException } from '@nestjs/common';

describe('CreateUserHandler', () => {
  let handler: CreateUserHandler;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock }; $transaction: jest.Mock };
  let password: { hash: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'u1' }),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };
    password = { hash: jest.fn().mockResolvedValue('hashed') };
    handler = new CreateUserHandler(prisma as any, password as any);
  });

  it('creates user when email is unique', async () => {
    const result = await handler.execute({
      email: 'test@example.com',
      password: 'secret',
      name: 'Test',
      role: 'OWNER',
    } as any);
    expect(result.id).toBe('u1');
    expect(password.hash).toHaveBeenCalledWith('secret');
  });

  it('throws when email already registered', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      handler.execute({ email: 'test@example.com', password: 'secret' } as any),
    ).rejects.toThrow(ConflictException);
  });
});
