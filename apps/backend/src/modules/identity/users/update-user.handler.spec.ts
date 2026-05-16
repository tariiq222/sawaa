import { UpdateUserHandler } from './update-user.handler';
import { NotFoundException } from '@nestjs/common';

describe('UpdateUserHandler', () => {
  let handler: UpdateUserHandler;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock }; $transaction: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1' }),
        update: jest.fn().mockResolvedValue({ id: 'u1', name: 'Updated' }),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };
    const rlsTransaction = { withTransaction: jest.fn((fn: any) => fn(prisma)) };
    handler = new UpdateUserHandler(prisma as any, rlsTransaction as any);
  });

  it('updates user when found', async () => {
    const result = await handler.execute({ userId: 'u1', name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('throws when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ userId: 'u1' })).rejects.toThrow(NotFoundException);
  });
});
