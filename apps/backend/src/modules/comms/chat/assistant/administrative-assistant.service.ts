import { Injectable, Logger } from '@nestjs/common';
import {
  ChatMessageKind,
  ConversationStatus,
  MessageSenderType,
  Prisma,
  type CommsChatMessage,
} from '@prisma/client';
import {
  ChatAdapter,
  type ChatMessage,
  type CompletionWithToolsResult,
} from '../../../../infrastructure/ai/chat.adapter';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { GetChatbotConfigHandler } from '../../../ai/chatbot-config/get-chatbot-config.handler';
import { AdministrativeToolContext } from './administrative-tool-context';
import { AdministrativeToolsService } from './administrative-tools.service';
import { buildAdministrativeSystemPrompt } from './administrative-policy';

const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ROUNDS = 4;
const MAX_OUTPUT_TOKENS = 800;

class AdministrativeCompletionFailed extends Error {}
class ConversationStatusChanged extends Error {}

@Injectable()
export class AdministrativeAssistantService {
  private readonly logger = new Logger(AdministrativeAssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly chat: ChatAdapter,
    private readonly tools: AdministrativeToolsService,
    private readonly getChatbotConfig: GetChatbotConfigHandler,
  ) {}

  async processMessage(messageId: string): Promise<CommsChatMessage | null> {
    const existing = await this.findExistingResponse(messageId);
    if (existing) return existing;

    const inbound = await this.prisma.commsChatMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        conversationId: true,
        senderType: true,
        body: true,
      },
    });
    if (!inbound || !this.isInboundSender(inbound.senderType)) return null;

    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: inbound.conversationId },
      select: {
        id: true,
        clientId: true,
        language: true,
        isAiChat: true,
        status: true,
      },
    });
    if (!conversation || !this.canUseAi(conversation)) return null;

    const startedAt = Date.now();
    try {
      if (!this.chat.isAvailable()) throw new AdministrativeCompletionFailed();

      const [historyRows, config] = await Promise.all([
        this.prisma.commsChatMessage.findMany({
          where: {
            conversationId: conversation.id,
            senderType: { in: [MessageSenderType.CLIENT, MessageSenderType.VISITOR, MessageSenderType.AI] },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: MAX_HISTORY_MESSAGES,
          select: { senderType: true, body: true },
        }),
        this.getChatbotConfig.execute(),
      ]);

      const customPrompt = conversation.language.toLowerCase().startsWith('en')
        ? config.systemPromptEn || config.systemPromptAr
        : config.systemPromptAr || config.systemPromptEn;
      const messages: ChatMessage[] = [
        { role: 'system', content: buildAdministrativeSystemPrompt(customPrompt) },
        ...historyRows.reverse().map((message) => ({
          role: message.senderType === MessageSenderType.AI ? 'assistant' as const : 'user' as const,
          content: message.body,
        })),
      ];

      const result = await this.runToolRounds(
        messages,
        new AdministrativeToolContext(conversation.id, conversation.clientId),
      );
      const body = result.content?.trim();
      if (!body) throw new AdministrativeCompletionFailed();

      return await this.persistResponse({
        messageId,
        conversationId: conversation.id,
        body,
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      if (error instanceof ConversationStatusChanged) return null;
      await this.markRetryableFailure(messageId);
      this.logger.warn('Administrative assistant attempt failed; the message remains retryable');
      return null;
    }
  }

  private async runToolRounds(
    messages: ChatMessage[],
    context: AdministrativeToolContext,
  ): Promise<CompletionWithToolsResult> {
    let tokensUsed = 0;
    let model = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const result = await this.chat.completeWithTools(
        messages,
        this.tools.getDefinitions(),
        { maxTokens: MAX_OUTPUT_TOKENS, temperature: 0.2 },
      );
      tokensUsed += result.tokensUsed;
      model = result.model;

      if (result.toolCalls.length === 0) {
        return { ...result, tokensUsed };
      }

      messages.push({
        role: 'assistant',
        content: result.content ?? '',
        toolCalls: result.toolCalls,
      });
      for (const toolCall of result.toolCalls) {
        const toolResult = await this.tools.execute(
          toolCall.function.name,
          toolCall.function.arguments,
          context,
        );
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResult),
          tool_call_id: toolCall.id,
        });
      }
    }

    throw new AdministrativeCompletionFailed(`Tool round limit reached for model ${model}`);
  }

  private async persistResponse(input: {
    messageId: string;
    conversationId: string;
    body: string;
    model: string;
    tokensUsed: number;
    latencyMs: number;
  }): Promise<CommsChatMessage | null> {
    try {
      return await this.rlsTransaction.withTransaction(async (tx) => {
        const existing = await tx.commsChatMessage.findUnique({
          where: { responseForMessageId: input.messageId },
        });
        if (existing) return existing;

        const conversation = await tx.chatConversation.findUnique({
          where: { id: input.conversationId },
          select: { status: true, isAiChat: true },
        });
        if (!conversation || !this.canUseAi(conversation)) return null;

        const response = await tx.commsChatMessage.create({
          data: {
            conversationId: input.conversationId,
            senderType: MessageSenderType.AI,
            senderId: null,
            body: input.body,
            kind: ChatMessageKind.TEXT,
            metadata: Prisma.JsonNull,
            responseForMessageId: input.messageId,
            model: input.model,
            tokensUsed: input.tokensUsed,
            latencyMs: input.latencyMs,
          },
        });
        const updated = await tx.chatConversation.updateMany({
          where: {
            id: input.conversationId,
            status: ConversationStatus.AI_ACTIVE,
            isAiChat: true,
          },
          data: {
            lastMessageAt: new Date(),
            clientUnreadCount: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new ConversationStatusChanged();
        return response;
      });
    } catch (error) {
      if (error instanceof ConversationStatusChanged) throw error;
      if (!this.isDuplicateResponse(error)) throw error;
      return this.findExistingResponse(input.messageId);
    }
  }

  private findExistingResponse(messageId: string): Promise<CommsChatMessage | null> {
    return this.prisma.commsChatMessage.findUnique({
      where: { responseForMessageId: messageId },
    });
  }

  private async markRetryableFailure(messageId: string): Promise<void> {
    try {
      await this.prisma.commsChatMessage.update({
        where: { id: messageId },
        data: {
          metadata: {
            assistantStatus: 'RETRYABLE_FAILURE',
            retryable: true,
          },
        },
      });
    } catch {
      this.logger.warn('Could not mark the administrative assistant attempt as retryable');
    }
  }

  private isDuplicateResponse(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private isInboundSender(senderType: MessageSenderType): boolean {
    return senderType === MessageSenderType.CLIENT || senderType === MessageSenderType.VISITOR;
  }

  private canUseAi(conversation: { status: ConversationStatus; isAiChat: boolean }): boolean {
    return conversation.isAiChat && conversation.status === ConversationStatus.AI_ACTIVE;
  }
}
