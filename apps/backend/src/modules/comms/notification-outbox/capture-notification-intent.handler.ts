import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';

import { PrismaService } from '../../../infrastructure/database';
import { CaptureNotificationIntent } from './notification-outbox.types';

function normalizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`)
    .join(',')}}`;
}

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}

@Injectable()
export class CaptureNotificationIntentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CaptureNotificationIntent, tx?: Prisma.TransactionClient): Promise<string> {
    const payload = normalizeJson(command.payload);
    const payloadHash = hashPayload(payload);
    const run = async (db: Prisma.TransactionClient | PrismaService): Promise<string> => {
      const existing = await db.notificationIntent.findUnique({
        where: {
          sourceKey_consumerKey: {
            sourceKey: command.sourceKey,
            consumerKey: command.consumerKey,
          },
        },
        select: { id: true, payloadHash: true, sourceOutboxId: true },
      });

      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          throw new ConflictException('Notification intent payload hash conflict');
        }
        if (command.sourceOutboxId && !existing.sourceOutboxId) {
          await db.notificationIntent.update({
            where: { id: existing.id },
            data: { sourceOutboxId: command.sourceOutboxId },
          });
        }
        return existing.id;
      }

      const created = await db.notificationIntent.create({
        data: {
          sourceKey: command.sourceKey,
          consumerKey: command.consumerKey,
          sourceOutboxId: command.sourceOutboxId,
          payloadVersion: command.payloadVersion,
          payload,
          payloadHash,
          expiresAt: command.expiresAt,
        },
        select: { id: true },
      });
      return created.id;
    };

    if (tx) return run(tx);

    try {
      // Sawaa is single-tenant and RLS has been removed. This direct transaction
      // keeps an independently captured intent atomic outside request context.
      // eslint-disable-next-line no-restricted-syntax
      return await this.prisma.$transaction((transaction) => run(transaction));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.prisma.notificationIntent.findUnique({
        where: {
          sourceKey_consumerKey: {
            sourceKey: command.sourceKey,
            consumerKey: command.consumerKey,
          },
        },
        select: { id: true, payloadHash: true },
      });
      if (!winner) throw error;
      if (winner.payloadHash !== payloadHash) {
        throw new ConflictException('Notification intent payload hash conflict');
      }
      return winner.id;
    }
  }
}

export { canonicalize, hashPayload, normalizeJson };
