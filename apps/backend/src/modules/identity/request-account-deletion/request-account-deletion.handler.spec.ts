import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { RequestAccountDeletionHandler } from './request-account-deletion.handler';
import { RlsTransactionService } from '../../../infrastructure/database';

describe('RequestAccountDeletionHandler', () => {
  let handler: RequestAccountDeletionHandler;
  let tx: {
    $queryRaw: jest.Mock;
    client: { findFirst: jest.Mock; update: jest.Mock };
    clientRefreshToken: { updateMany: jest.Mock };
    fcmToken: { deleteMany: jest.Mock };
    user: { findUnique: jest.Mock; update: jest.Mock };
    refreshToken: { updateMany: jest.Mock };
  };

  beforeEach(async () => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      client: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      clientRefreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      fcmToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const module = await Test.createTestingModule({
      providers: [
        RequestAccountDeletionHandler,
        {
          provide: RlsTransactionService,
          useValue: { withTransaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) },
        },
      ],
    }).compile();
    handler = module.get(RequestAccountDeletionHandler);
  });

  it('refuses a missing or already closed account', async () => {
    tx.client.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ clientId: 'c1' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.client.update).not.toHaveBeenCalled();
  });

  it('closes login without copying the phone into notes or deleting clinical rows', async () => {
    tx.client.findFirst.mockResolvedValue({ id: 'c1', userId: 'u1' });
    tx.user.findUnique.mockResolvedValue({ id: 'u1', role: 'CLIENT' });

    await expect(handler.execute({ clientId: 'c1' })).resolves.toEqual({
      status: 'scheduled',
      retained: ['clinical_records', 'financial_records'],
    });

    expect(tx.clientRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { clientId: 'c1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.fcmToken.deleteMany).toHaveBeenCalledWith({ where: { clientId: 'c1' } });
    const clientUpdate = tx.client.update.mock.calls[0][0];
    expect(clientUpdate.where).toEqual({ id: 'c1' });
    expect(clientUpdate.data).toEqual(expect.objectContaining({
      isActive: false,
      phone: null,
      email: null,
      nationalId: null,
      passwordHash: null,
      tokenVersion: { increment: 1 },
    }));
    expect(clientUpdate.data).not.toHaveProperty('notes');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({
        isActive: false,
        phone: null,
        email: 'deleted-u1@account.invalid',
        tokenVersion: { increment: 1 },
      }),
    });
  });

  it('does not rewrite a staff user linked to the client record', async () => {
    tx.client.findFirst.mockResolvedValue({ id: 'c1', userId: 'staff-1' });
    tx.user.findUnique.mockResolvedValue({ id: 'staff-1', role: 'RECEPTIONIST' });

    await handler.execute({ clientId: 'c1' });

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(tx.client.update).toHaveBeenCalled();
  });
});
