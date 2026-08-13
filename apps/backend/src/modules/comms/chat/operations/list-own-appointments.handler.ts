import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  ChatOperationStatus,
  ChatOperationType,
  Prisma,
  type ChatOperation,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import {
  ListClientBookingsHandler,
  type ListClientBookingsResult,
} from '../../../bookings/client/list-client-bookings.handler';

export interface ListOwnAppointmentsCommand {
  conversationId: string;
  clientId: string | null;
  sourceMessageId: string;
}

export type ListOwnAppointmentsResult =
  | { kind: 'AUTH_REQUIRED'; operation: ChatOperation }
  | { kind: 'APPOINTMENTS'; appointments: ListClientBookingsResult };

@Injectable()
export class ListOwnAppointmentsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly listBookings: ListClientBookingsHandler,
  ) {}

  async execute(command: ListOwnAppointmentsCommand): Promise<ListOwnAppointmentsResult> {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: command.conversationId },
      select: { id: true, clientId: true },
    });
    if (!conversation || conversation.clientId !== command.clientId) {
      throw new ForbiddenException('Conversation does not belong to this client');
    }
    if (command.clientId) {
      return {
        kind: 'APPOINTMENTS',
        appointments: await this.listBookings.execute(command.clientId, 1, 10),
      };
    }

    const idempotencyKey = `chat:${command.sourceMessageId}:listOwnAppointments:${createHash('sha256')
      .update(command.conversationId)
      .digest('hex')}`;
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const createOrGet = async (tx: Prisma.TransactionClient) => {
      const existing = await tx.chatOperation.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
      return tx.chatOperation.create({
        data: {
          conversationId: command.conversationId,
          clientId: null,
          type: ChatOperationType.LIST_OWN_APPOINTMENTS,
          status: ChatOperationStatus.AWAITING_AUTH,
          payload: { intent: 'LIST_OWN_APPOINTMENTS' },
          summary: { action: 'LOGIN_REQUIRED', intent: 'LIST_OWN_APPOINTMENTS' },
          idempotencyKey,
          requiredConfirmations: 0,
          expiresAt,
        },
      });
    };

    try {
      return { kind: 'AUTH_REQUIRED', operation: await this.rlsTransaction.withTransaction(createOrGet) };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const existing = await this.prisma.chatOperation.findUnique({ where: { idempotencyKey } });
      if (!existing) throw error;
      return { kind: 'AUTH_REQUIRED', operation: existing };
    }
  }
}
