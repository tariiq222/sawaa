import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";

/**
 * Closes a conversation and releases any active staff takeover.
 * The next inbound message reopens the durable phone thread.
 */
@Injectable()
export class CloseWhatsappConversationHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string) {
    const conversation = await this.prisma.whatsappConversation.findUnique({
      where: { id },
      select: { context: true },
    });
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const context =
      conversation.context &&
      typeof conversation.context === "object" &&
      !Array.isArray(conversation.context)
        ? (conversation.context as Record<string, unknown>)
        : {};
const sanitizedContext = { ...context } as Record<string, unknown>;
    delete sanitizedContext.pendingBooking;
    delete sanitizedContext.pendingProposalId;
    delete sanitizedContext.pendingProposalExpiresAt;

    await this.prisma.whatsappConversation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        staffTakeover: false,
        staffUserId: null,
        staffTookOverAt: null,
        context: sanitizedContext as object,
      },
    });

    return { closed: true };
  }
}
