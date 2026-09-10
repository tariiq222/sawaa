import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/database';
import { NotificationOutboxConsumerKey } from './notification-outbox.types';

@Injectable()
export class ResolveNotificationIntentOwnershipHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: {
    sourceKey: string;
    consumerKey: NotificationOutboxConsumerKey;
  }): Promise<string | null> {
    const intent = await this.prisma.notificationIntent.findUnique({
      where: { sourceKey_consumerKey: query },
      select: { id: true },
    });
    return intent?.id ?? null;
  }
}
