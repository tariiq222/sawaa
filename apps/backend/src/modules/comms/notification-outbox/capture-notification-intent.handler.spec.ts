import { ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';

import { PrismaService } from '../../../infrastructure/database';
import {
  CaptureNotificationIntent,
  NOTIFICATION_OUTBOX_PAYLOAD_VERSION,
} from './notification-outbox.types';
import { CaptureNotificationIntentHandler } from './capture-notification-intent.handler';

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`)
    .join(',')}}`;
};

const payload = {
  kind: 'client-enrolled-client' as const,
  clientId: 'client-1',
  name: 'سارة',
  email: 'sara@example.com',
};

const command: CaptureNotificationIntent = {
  sourceKey: 'client-enrolled:client-1',
  consumerKey: 'comms.client-enrolled-client.v2',
  sourceOutboxId: '00000000-0000-0000-0000-000000000001',
  payloadVersion: NOTIFICATION_OUTBOX_PAYLOAD_VERSION,
  payload,
  occurredAt: new Date('2026-09-05T12:00:00.000Z'),
};

describe('CaptureNotificationIntentHandler', () => {
  let handler: CaptureNotificationIntentHandler;
  let prisma: {
    $transaction: jest.Mock;
    notificationIntent: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) => callback(prisma)),
      notificationIntent: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    handler = new CaptureNotificationIntentHandler(prisma as unknown as PrismaService);
  });

  it('creates one intent with a canonical SHA-256 payload hash and returns its id', async () => {
    prisma.notificationIntent.findUnique.mockResolvedValue(null);
    prisma.notificationIntent.create.mockResolvedValue({ id: 'intent-1' });

    await expect(handler.execute(command)).resolves.toBe('intent-1');

    expect(prisma.notificationIntent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sourceKey: command.sourceKey,
        consumerKey: command.consumerKey,
        sourceOutboxId: command.sourceOutboxId,
        payloadVersion: 1,
        payload: command.payload,
        payloadHash: createHash('sha256').update(canonicalize(command.payload)).digest('hex'),
      }),
    }));
  });

  it('uses a supplied transaction client without opening a nested transaction', async () => {
    const tx = {
      notificationIntent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'intent-tx' }) },
    };

    await expect(handler.execute(command, tx as never)).resolves.toBe('intent-tx');

    expect(tx.notificationIntent.create).toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns the existing id for an identical replay, including equivalent object key order', async () => {
    prisma.notificationIntent.findUnique.mockResolvedValue({
      id: 'intent-existing',
      payloadHash: createHash('sha256').update(canonicalize(payload)).digest('hex'),
      sourceOutboxId: command.sourceOutboxId,
    });

    await expect(
      handler.execute({
        ...command,
        payload: { email: payload.email, name: payload.name, clientId: payload.clientId, kind: payload.kind },
      }),
    ).resolves.toBe('intent-existing');
    expect(prisma.notificationIntent.create).not.toHaveBeenCalled();
  });

  it('hashes and stores the same JSON shape after undefined object values are removed', async () => {
    prisma.notificationIntent.findUnique.mockResolvedValue(null);
    prisma.notificationIntent.create.mockResolvedValue({ id: 'intent-normalized' });

    await handler.execute({ ...command, payload: { ...payload, email: undefined } });

    const data = prisma.notificationIntent.create.mock.calls[0][0].data;
    expect(data.payload).toEqual({ kind: payload.kind, clientId: payload.clientId, name: payload.name });
    expect(data.payloadHash).toBe(
      createHash('sha256').update(canonicalize(data.payload)).digest('hex'),
    );
  });

  it('rejects same-key payload drift as an explicit conflict without overwriting the row', async () => {
    prisma.notificationIntent.findUnique.mockResolvedValue({
      id: 'intent-existing',
      payloadHash: 'different-hash',
    });

    await expect(handler.execute(command)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.notificationIntent.create).not.toHaveBeenCalled();
  });

  it('recovers a concurrent unique-key race by reading the winner after the insert conflict', async () => {
    prisma.notificationIntent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'intent-race-winner',
        payloadHash: createHash('sha256').update(canonicalize(payload)).digest('hex'),
      });
    prisma.notificationIntent.create.mockRejectedValue({ code: 'P2002' });

    await expect(handler.execute(command)).resolves.toBe('intent-race-winner');
  });

  it('does not convert an unrelated database failure into a replay', async () => {
    prisma.notificationIntent.findUnique.mockResolvedValue(null);
    prisma.notificationIntent.create.mockRejectedValue(new Error('database unavailable'));

    await expect(handler.execute(command)).rejects.toThrow('database unavailable');
  });
});
