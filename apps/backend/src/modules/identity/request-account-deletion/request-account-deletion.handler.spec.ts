import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { RequestAccountDeletionHandler } from './request-account-deletion.handler';
import { CLIENT_ACCOUNT_STORE } from '../../../common/contracts/client-account.contract';
import { PgClientAccountStore } from '../../../modules/people/clients/client-account.store';
import { TransactionService } from '../../../infrastructure/database';

describe('RequestAccountDeletionHandler', () => {
  let handler: RequestAccountDeletionHandler;
  let tx: {
    $queryRaw: jest.Mock;
    client: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    clientRefreshToken: { updateMany: jest.Mock };
    fcmToken: { deleteMany: jest.Mock };
    user: { findUnique: jest.Mock; update: jest.Mock };
    refreshToken: { updateMany: jest.Mock };
  };

  beforeEach(async () => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      client: {
        findUnique: jest.fn(),
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
          provide: TransactionService,
          useValue: { withTransaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) },
        },
        { provide: CLIENT_ACCOUNT_STORE, useValue: new PgClientAccountStore() },
      ],
    }).compile();
    handler = module.get(RequestAccountDeletionHandler);
  });

  it('refuses a missing or already closed account', async () => {
    tx.client.findUnique.mockResolvedValue({ userId: null });
    tx.client.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ clientId: 'c1' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.client.update).not.toHaveBeenCalled();
  });

  it('closes login without copying the phone into notes or deleting clinical rows', async () => {
    tx.client.findUnique.mockResolvedValue({ userId: 'u1' });
    // lockForAuth re-reads through the store after the raw FOR UPDATE; it needs
    // the full row shape for the anonimized write it performs next.
    tx.client.findUnique.mockResolvedValueOnce({ userId: 'u1' }).mockResolvedValueOnce({
      id: 'c1', userId: 'u1', deletedAt: null, isActive: true,
    });
    tx.user.findUnique.mockResolvedValue({ id: 'u1', role: 'CLIENT' });

    await expect(handler.execute({ clientId: 'c1' })).resolves.toEqual({
      status: 'closed',
      retained: ['clinical_records', 'financial_records'],
    });

    expect(tx.clientRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { clientId: 'c1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.fcmToken.deleteMany).toHaveBeenCalledWith({ where: { clientId: 'c1' } });
    // The anonymizing write goes through the store; assert the same fields.
    const clientUpdate = tx.client.update.mock.calls[0][0];
    expect(clientUpdate.where).toEqual({ id: 'c1' });
    expect(clientUpdate.data).toEqual(expect.objectContaining({
      deletedAt: expect.any(Date),
      isActive: false,
      phone: null,
      email: null,
      nationalId: null,
      emergencyName: null,
      emergencyPhone: null,
      avatarUrl: null,
      pushEnabled: false,
      passwordHash: null,
      tokenVersion: { increment: 1 },
    }));
    expect(clientUpdate.data).not.toHaveProperty('notes');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
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
    tx.client.findUnique.mockResolvedValue({ userId: 'staff-1' });
    tx.client.findUnique.mockResolvedValueOnce({ userId: 'staff-1' }).mockResolvedValueOnce({
      id: 'c1', userId: 'staff-1', deletedAt: null, isActive: true,
    });
    tx.user.findUnique.mockResolvedValue({ id: 'staff-1', role: 'RECEPTIONIST' });

    await handler.execute({ clientId: 'c1' });

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(tx.client.update).toHaveBeenCalled();
  });

  it('rejects when the linked user changes before the client lock', async () => {
    tx.client.findUnique.mockResolvedValue({ userId: null });
    tx.client.findFirst.mockResolvedValue({ id: 'c1', userId: 'u1' });

    await expect(handler.execute({ clientId: 'c1' })).rejects.toThrow();
    expect(tx.client.update).not.toHaveBeenCalled();
  });
});
