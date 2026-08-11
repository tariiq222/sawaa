import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";
import { WhatsappTransportService } from "../../../infrastructure/whatsapp/whatsapp-transport.service";
import { StaffReplyDto } from "../../integrations/whatsapp/dto/upsert-whatsapp-config.dto";

/**
 * Sends a message on behalf of staff and disables the auto-reply for this
 * conversation (staff takeover). The runtime layer sees `staffTakeover=true`
 * and stops responding until the conversation is closed or takeover released.
 */
@Injectable()
export class StaffReplyHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transport: WhatsappTransportService,
  ) {}

  async execute(conversationId: string, userId: string, dto: StaffReplyDto) {
    const conversation = await this.prisma.whatsappConversation.findUnique({
      where: { id: conversationId },
      select: { context: true, phone: true },
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

    // Claim takeover first so an in-flight AI reply observes it before sending.
    await this.prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: {
        staffTakeover: true,
        staffUserId: userId,
        staffTookOverAt: new Date(),
        status: "TAKEOVER",
        lastMessageAt: new Date(),
        context: sanitizedContext as object,
      },
    });

    const message = await this.prisma.whatsappMessage.create({
      data: {
        conversationId,
        role: "STAFF",
        content: dto.message,
        deliveryStatus: "PENDING",
      },
    });

    try {
      const { client } = await this.transport.resolve();
      const result = await client.sendText({
        number: conversation.phone,
        text: dto.message,
      });

      await this.prisma.whatsappMessage.update({
        where: { id: message.id },
        data: {
          deliveryStatus: result.ok ? "SENT" : "FAILED",
          providerMessageId: result.messageId ?? result.external ?? null,
          errorMessage: result.ok ? null : (result.error ?? null),
        },
      });

      return {
        ok: result.ok,
        messageId: result.messageId,
        error: result.error,
        persistedMessageId: message.id,
      };
    } catch (error: unknown) {
      const messageText =
        error instanceof Error ? error.message : "WhatsApp transport failed";
      await this.prisma.whatsappMessage.update({
        where: { id: message.id },
        data: {
          deliveryStatus: "FAILED",
          errorMessage: messageText.slice(0, 500),
        },
      });
      return {
        ok: false,
        messageId: undefined,
        error: messageText,
        persistedMessageId: message.id,
      };
    }
  }
}
