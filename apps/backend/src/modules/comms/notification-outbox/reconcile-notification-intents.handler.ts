import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/database';
import { NotificationOutboxConfig } from './notification-outbox.config';
import { MaterializeNotificationIntentHandler } from './materialize-notification-intent.handler';
import { NotificationOutboxTickResult } from './notification-outbox.types';

const MATERIALIZE_RETRY_DELAYS_MS = [30_000, 120_000, 300_000, 900_000] as const;
const MAX_MATERIALIZE_ATTEMPTS = 5;

@Injectable()
export class ReconcileNotificationIntentsHandler {
  constructor(private readonly prisma: PrismaService, private readonly materialize: MaterializeNotificationIntentHandler, private readonly config: NotificationOutboxConfig) {}

  async execute(): Promise<NotificationOutboxTickResult> {
    let examined = 0; let changed = 0; let failed = 0; let cursor: string | undefined;
    for (;;) {
      const intents = await this.prisma.notificationIntent.findMany({ where: { status: { in: ['PENDING', 'RETRY_WAIT'] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }], ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: 100 });
      if (!intents.length) break;
      for (const intent of intents) {
        examined += 1; cursor = intent.id;
        try {
          await this.materialize.execute(intent.id);
          changed += 1;
        } catch {
          failed += 1;
          const attempts = intent.attempts + 1;
          await this.prisma.notificationIntent.updateMany({
            where: { id: intent.id, status: intent.status, attempts: intent.attempts },
            data: attempts >= MAX_MATERIALIZE_ATTEMPTS
              ? { status: 'DEAD', attempts: { increment: 1 }, nextAttemptAt: null }
              : {
                  status: 'RETRY_WAIT',
                  attempts: { increment: 1 },
                  nextAttemptAt: new Date(
                    Date.now() + MATERIALIZE_RETRY_DELAYS_MS[Math.min(attempts - 1, MATERIALIZE_RETRY_DELAYS_MS.length - 1)],
                  ),
                },
          });
        }
      }
    }
    return { examined, changed, failed };
  }
}
