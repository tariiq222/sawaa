import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, type ChatConversation } from '@prisma/client';
import { SAUDI_PHONE_REGEX } from '@sawaa/shared/validators/phone';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { ChatAuditService } from '../chat-audit.service';
import { parseHandoffSummary, type HandoffSummary } from '../assistant/administrative-tools.service';
import { lockChatConversation } from '../conversation-lock.helper';

export const RECEPTION_HANDOFF_CONFIRMATION = 'تم استلام طلبك وتحويله لفريق الاستقبال، وبيتواصلون معك خلال أوقات عمل المركز.';

export type RequestHandoffCommand =
  | {
      audience: 'guest';
      conversationId: string;
      guestToken: string;
      guestName: string;
      guestPhone: string;
      handoffSummary?: unknown;
    }
  | { audience: 'client'; conversationId: string; clientId: string; handoffSummary?: unknown }
  | {
      audience: 'assistant'; conversationId: string; clientId: string | null; guestTokenHash: string | null;
      guestName: string | null; guestPhone: string | null; stateVersion: number; customerContextVersion: number;
      status: ConversationStatus; customerContext: unknown; handoffSummary: unknown;
    };

@Injectable()
export class RequestHandoffHandler {
  constructor(
    private readonly rlsTransaction: RlsTransactionService,
    private readonly access: ChatAccessService,
    private readonly audit: ChatAuditService,
  ) {}

  async execute(command: RequestHandoffCommand): Promise<ChatConversation> {
    const conversation = command.audience === 'assistant'
      ? command
      : command.audience === 'guest'
        ? await this.access.assertGuestAccess(command.conversationId, command.guestToken)
        : await this.access.assertClientAccess(command.conversationId, command.clientId);

    const contact = command.audience === 'guest' || (command.audience === 'assistant' && command.clientId === null)
      ? this.guestContact(command.guestName ?? '', command.guestPhone ?? '')
      : {};
    const handoffSummary = command.handoffSummary === undefined
      ? undefined
      : parseHandoffSummary(command.handoffSummary);
    if (command.handoffSummary !== undefined && !handoffSummary) {
      throw new BadRequestException('Handoff summary is invalid');
    }
    const ownership = command.audience === 'guest'
      ? { clientId: null, guestTokenHash: conversation.guestTokenHash }
      : command.audience === 'assistant'
        ? { clientId: command.clientId, guestTokenHash: command.guestTokenHash }
      : { clientId: command.clientId };
    if (conversation.status !== ConversationStatus.AI_ACTIVE && conversation.status !== ConversationStatus.WAITING_FOR_STAFF) {
      throw new ConflictException('Conversation cannot request reception in its current state');
    }
    return this.rlsTransaction.withTransaction(async (tx) => {
      await lockChatConversation(tx, command.conversationId);
      const versionWhere = {
        ...(typeof conversation.stateVersion === 'number' ? { stateVersion: conversation.stateVersion } : {}),
        ...(typeof conversation.customerContextVersion === 'number'
          ? { customerContextVersion: conversation.customerContextVersion }
          : {}),
      };
      const locked = await tx.chatConversation.findFirst({
        where: { id: command.conversationId, ...ownership, ...versionWhere },
        select: { id: true, status: true, customerContext: true },
      });
      if (!locked && command.audience === 'assistant') {
        const currentWaiting = await tx.chatConversation.findFirst({
          where: { id: command.conversationId, status: ConversationStatus.WAITING_FOR_STAFF, ...ownership },
        });
        if (currentWaiting) return currentWaiting;
      }
      if (!locked) throw new ConflictException('Conversation ownership or state changed before reception request');
      if (locked.status === ConversationStatus.WAITING_FOR_STAFF) {
        const ownedWaiting = await tx.chatConversation.findFirst({
          where: { id: command.conversationId, status: ConversationStatus.WAITING_FOR_STAFF, ...ownership, ...versionWhere },
        });
        if (ownedWaiting) return ownedWaiting;
        throw new ConflictException('Conversation ownership changed before reception request');
      }
      if (handoffSummary?.serviceId) {
        const service = await tx.service.findFirst({
          where: { id: handoffSummary.serviceId, isActive: true },
          select: { id: true },
        });
        if (!service) throw new ConflictException('Handoff service is no longer available');
      }
      if (handoffSummary?.practitionerId) {
        const practitioner = await tx.employee.findFirst({
          where: { id: handoffSummary.practitionerId, isActive: true, isPublic: true },
          select: { id: true },
        });
        if (!practitioner) throw new ConflictException('Handoff practitioner is no longer available');
        if (handoffSummary.serviceId) {
          const assignment = await tx.employeeService.findFirst({
            where: { employeeId: handoffSummary.practitionerId, serviceId: handoffSummary.serviceId, isActive: true },
            select: { id: true },
          });
          if (!assignment) throw new ConflictException('Handoff practitioner does not offer this service');
        }
      }
      const updated = await tx.chatConversation.updateMany({
        where: { id: command.conversationId, status: ConversationStatus.AI_ACTIVE, ...ownership, ...versionWhere },
        data: {
          status: ConversationStatus.WAITING_FOR_STAFF,
          handoffRequestedAt: new Date(),
          lastMessageAt: new Date(),
          clientUnreadCount: { increment: 1 },
          stateVersion: { increment: 1 },
          assistantLeaseOwner: null,
          assistantLeaseExpiresAt: null,
          ...(handoffSummary ? {
            customerContext: this.withHandoffSummary(locked.customerContext, handoffSummary),
            customerContextVersion: { increment: 1 },
          } : {}),
          ...contact,
        },
      });
      if (updated.count === 1) {
        await tx.commsChatMessage.create({
          data: {
            conversationId: command.conversationId,
            senderType: 'SYSTEM',
            senderId: null,
            body: RECEPTION_HANDOFF_CONFIRMATION,
            kind: 'SYSTEM_EVENT',
            clientMessageId: `handoff:${command.conversationId}:state:${conversation.stateVersion ?? 0}`,
            metadata: { action: 'HANDOFF_REQUESTED' },
          },
        });
      }
      const current = await tx.chatConversation.findFirst({
        where: { id: command.conversationId, status: ConversationStatus.WAITING_FOR_STAFF, ...ownership },
      });
      if (updated.count === 1 && current) {
        await this.audit.record({ action: 'HANDOFF_REQUESTED', conversationId: command.conversationId }, tx);
        return current;
      }
      if (!current) {
        const exists = await tx.chatConversation.findUnique({
          where: { id: command.conversationId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('Conversation not found');
        throw new ConflictException('Conversation ownership or state changed before reception request');
      }
      return current;
    });
  }

  private withHandoffSummary(current: unknown, summary: HandoffSummary) {
    const context = current && typeof current === 'object' && !Array.isArray(current)
      ? current as Record<string, unknown>
      : {};
    return { ...context, handoffSummary: { ...summary } };
  }

  private guestContact(guestName: string, guestPhone: string) {
    const trimmedName = guestName.trim();
    if (!trimmedName || trimmedName.length > 120 || !SAUDI_PHONE_REGEX.test(guestPhone)) {
      throw new BadRequestException('Guest name and a valid Saudi mobile are required');
    }
    return { guestName: trimmedName, guestPhone };
  }
}
