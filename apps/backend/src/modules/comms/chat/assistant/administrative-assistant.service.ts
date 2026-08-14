import { Injectable, Logger } from '@nestjs/common';
import {
  ChatMessageKind,
  ConversationStatus,
  MessageSenderType,
  Prisma,
  type CommsChatMessage,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  ChatAdapter,
  type ChatMessage,
  type CompletionWithToolsResult,
} from '../../../../infrastructure/ai/chat.adapter';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { AdministrativeAssistantLeaseService } from './administrative-assistant-lease.service';
import { AdministrativeOutputValidator } from './administrative-output-validator';
import {
  AdministrativeResponseRenderer,
  type ExecutedAdministrativeTool,
} from './administrative-response-renderer';
import {
  buildAdministrativeSystemPrompt,
  getAdministrativeFallbackResponse,
  type AdministrativePublicMetadata,
  type AdministrativeHandoffMetadata,
} from './administrative-policy';
import { AdministrativeScopeGate } from './administrative-scope-gate';
import { AdministrativeToolContext } from './administrative-tool-context';
import {
  AdministrativeToolsService,
} from './administrative-tools.service';
import { readAdministrativeMessageState, readNonNegativeInteger } from './administrative-message-state';
import {
  ChatDailyBudgetExceeded,
  ChatUsageLimitsService,
  type ChatDailyTokenReservation,
} from '../chat-usage-limits.service';
import { WebChatAvailabilityService } from '../web-chat-availability.service';

const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_CHARS = 12_000;
const MAX_TOOL_ROUNDS = 4;
const MAX_TOOL_CALLS_PER_ROUND = 3;
const MAX_TOTAL_TOOL_CALLS = 8;
const MAX_OUTPUT_TOKENS = 800;
const MAX_PROVIDER_MESSAGE_BYTES = 24_000;
const MAX_PROVIDER_SYSTEM_PROMPT_BYTES = 6_000;
const MAX_PROVIDER_TOOL_DEFINITION_BYTES = 12_000;
const MAX_PROVIDER_TOOL_RESULT_BYTES = 1_000;
const MAX_PROVIDER_TOOL_ARGUMENT_BYTES = 2_000;
const MAX_PROVIDER_MESSAGE_ENVELOPE_BYTES = 512;
// UTF-8 bytes are a conservative upper bound for provider input tokens. The
// message and definition bounds below are enforced immediately before every
// provider call, so this reservation cannot be exceeded by accumulated tools.
const MAX_REQUEST_TOKEN_ALLOWANCE = MAX_PROVIDER_MESSAGE_BYTES
  + MAX_PROVIDER_TOOL_DEFINITION_BYTES
  + MAX_OUTPUT_TOKENS;

class ConversationStatusChanged extends Error {}
class AssistantLeaseLost extends Error {}
class AdministrativeLimitReached extends Error {}

interface InboundMessage {
  id: string;
  conversationId: string;
  sequence: bigint;
  senderType: MessageSenderType;
  body: string;
  metadata: Prisma.JsonValue | null;
}

interface ActiveConversation {
  id: string;
  clientId: string | null;
  guestTokenHash: string | null;
  language: string;
  isAiChat: boolean;
  status: ConversationStatus;
  stateVersion: number;
}

@Injectable()
export class AdministrativeAssistantService {
  private readonly logger = new Logger(AdministrativeAssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly chat: ChatAdapter,
    private readonly tools: AdministrativeToolsService,
    private readonly lease: AdministrativeAssistantLeaseService,
    private readonly scopeGate: AdministrativeScopeGate,
    private readonly renderer: AdministrativeResponseRenderer,
    private readonly outputValidator: AdministrativeOutputValidator,
    private readonly limits: ChatUsageLimitsService,
    private readonly webChatAvailability: WebChatAvailabilityService,
  ) {}

  async processMessage(
    messageId: string,
    options: { manualRetry?: boolean; dispatchAttempt?: number } = {},
  ): Promise<CommsChatMessage | null> {
    if (!this.webChatAvailability.isEnabled()) return null;
    const existing = await this.findExistingResponse(messageId);
    if (existing) return existing;

    const target = await this.findInboundMessage(messageId);
    if (!target) return null;
    const state = readAdministrativeMessageState(target.metadata);
    if (
      options.dispatchAttempt !== undefined
      && readNonNegativeInteger(state.dispatchAttempt) !== options.dispatchAttempt
    ) return null;
    if (
      options.dispatchAttempt !== undefined
      && (state.assistantStatus !== 'QUEUED' && state.assistantStatus !== 'RETRYING')
    ) return null;
    if (
      options.dispatchAttempt !== undefined
      && Boolean(options.manualRetry) !== (state.assistantStatus === 'RETRYING')
    ) return null;
    if (!options.manualRetry && this.hasAssistantFailureMarker(target.metadata)) return null;

    const conversation = await this.findActiveConversation(target.conversationId);
    if (!conversation) return null;
    if (
      readNonNegativeInteger(state.assistantStateVersion) !== conversation.stateVersion
      || (state.assistantClientId ?? null) !== conversation.clientId
    ) return null;

    const owner = randomUUID();
    const dispatchAttempt = readNonNegativeInteger(state.dispatchAttempt);
    if (!await this.lease.acquire(conversation.id, owner, conversation.stateVersion, target.id, dispatchAttempt)) return null;

    try {
      if (!await this.lease.renew(conversation.id, owner, conversation.stateVersion, target.id, dispatchAttempt)) throw new AssistantLeaseLost();
      const response = await this.processInbound(target, conversation, owner, dispatchAttempt);
      if (response) await this.clearRetryableFailure(target);
      return response ?? this.findExistingResponse(messageId);
    } catch (error) {
      if (error instanceof ConversationStatusChanged || error instanceof AssistantLeaseLost) {
        await this.discardUnpublishedOperations(target.id, owner, dispatchAttempt);
        return null;
      }
      if (await this.markRetryableFailure(target, conversation, owner)) {
        this.logger.warn('Administrative assistant attempt failed; the message remains retryable');
      }
      return null;
    } finally {
      await this.lease.release(conversation.id, owner);
    }
  }

  private async processInbound(
    inbound: InboundMessage,
    conversation: ActiveConversation,
    leaseOwner: string,
    dispatchAttempt: number,
  ): Promise<CommsChatMessage | null> {
    const existing = await this.findExistingResponse(inbound.id);
    if (existing) return existing;

    const startedAt = Date.now();
    let body: string;
    let metadata: AdministrativePublicMetadata | null = null;
    let kind: ChatMessageKind = ChatMessageKind.TEXT;
    let model: string | null = null;
    let tokensUsed = 0;

    if (this.scopeGate.classify(inbound.body) === 'OUT_OF_SCOPE') {
      const fallback = getAdministrativeFallbackResponse(conversation.language, 'OUT_OF_SCOPE');
      body = fallback.body;
      metadata = fallback.metadata;
    } else {
      if (!this.chat.isAvailable()) throw new Error('assistant unavailable');
      const history = await this.loadHistory(conversation.id, inbound.sequence);
      try {
        const selection = await this.runToolRounds(
          [{ role: 'system', content: buildAdministrativeSystemPrompt() }, ...history],
          new AdministrativeToolContext(
            conversation.id,
            conversation.clientId,
            inbound.id,
            conversation.stateVersion,
            leaseOwner,
            dispatchAttempt,
          ),
          async () => {
            if (!await this.lease.renew(
              conversation.id,
              leaseOwner,
              conversation.stateVersion,
              inbound.id,
              dispatchAttempt,
            )) {
              throw new AssistantLeaseLost();
            }
          },
          conversation.clientId
            ? `client:${conversation.clientId}`
            : `guest:${conversation.guestTokenHash ?? conversation.id}`,
        );
        const rendered = this.renderer.render(selection.executions, conversation.language);
        const validated = this.outputValidator.validate(rendered, conversation.language);
        body = validated.body;
        metadata = validated.metadata;
        kind = validated.metadata?.action === 'CHAT_OPERATION'
          ? ChatMessageKind.ACTION_CARD
          : ChatMessageKind.TEXT;
        model = selection.model;
        tokensUsed = selection.tokensUsed;
      } catch (error) {
        if (!(error instanceof AdministrativeLimitReached)) throw error;
        const fallback = getAdministrativeFallbackResponse(conversation.language, 'LIMIT_REACHED');
        body = fallback.body;
        metadata = fallback.metadata;
      }
    }

    // The completion happens outside a database transaction. Confirm lease
    // ownership again immediately before the short persistence transaction.
    if (!await this.lease.renew(
      conversation.id,
      leaseOwner,
      conversation.stateVersion,
      inbound.id,
      dispatchAttempt,
    )) throw new AssistantLeaseLost();

    return this.persistResponse({
      messageId: inbound.id,
      conversationId: conversation.id,
      body,
      metadata,
      kind,
      model,
      tokensUsed,
      latencyMs: Date.now() - startedAt,
      stateVersion: conversation.stateVersion,
      leaseOwner,
      dispatchAttempt,
    });
  }

  private async loadHistory(conversationId: string, targetSequence: bigint): Promise<ChatMessage[]> {
    const rows = await this.prisma.commsChatMessage.findMany({
      where: {
        conversationId,
        sequence: { lte: targetSequence },
        senderType: { in: [MessageSenderType.CLIENT, MessageSenderType.VISITOR, MessageSenderType.AI] },
      },
      orderBy: { sequence: 'desc' },
      take: MAX_HISTORY_MESSAGES,
      select: { senderType: true, body: true, sequence: true },
    });

    let remaining = MAX_HISTORY_CHARS;
    const boundedNewestFirst: ChatMessage[] = [];
    for (const row of rows) {
      if (remaining === 0) break;
      if (
        row.senderType !== MessageSenderType.AI
        && this.scopeGate.classify(row.body) !== 'ADMINISTRATIVE'
      ) continue;
      const content = Array.from(row.body).slice(0, remaining).join('');
      if (!content) break;
      boundedNewestFirst.push({
        role: row.senderType === MessageSenderType.AI ? 'assistant' : 'user',
        content,
      });
      remaining -= content.length;
    }
    return boundedNewestFirst.reverse();
  }

  private async runToolRounds(
    messages: ChatMessage[],
    context: AdministrativeToolContext,
    assertLeaseHealthy: () => Promise<void>,
    usageIdentity: string,
  ): Promise<{
    executions: ExecutedAdministrativeTool[];
    model: string;
    tokensUsed: number;
  }> {
    let totalToolCalls = 0;
    let tokensUsed = 0;
    let model = '';
    const executions: ExecutedAdministrativeTool[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      await assertLeaseHealthy();
      let result: CompletionWithToolsResult;
      let reservation: ChatDailyTokenReservation | undefined;
      try {
        const providerMessages = this.boundedProviderMessages(messages);
        const definitions = this.boundedToolDefinitions();
        reservation = await this.limits.reserveDailyTokenBudget(
          usageIdentity,
          MAX_REQUEST_TOKEN_ALLOWANCE,
        );
        result = await this.chat.completeWithTools(
          providerMessages,
          definitions,
          { maxTokens: Math.min(MAX_OUTPUT_TOKENS, reservation.reservedTokens), temperature: 0.2 },
        );
        await this.limits.settleDailyTokenReservation(reservation, result.tokensUsed);
      } catch (error) {
        // Once completeWithTools is attempted, transport/provider errors can
        // be ambiguous about billing. Retain the reservation through its TTL.
        if (error instanceof ChatDailyBudgetExceeded) throw new AdministrativeLimitReached();
        throw error;
      }
      tokensUsed += result.tokensUsed;
      model = result.model;
      if (result.toolCalls.length === 0) return { executions, model, tokensUsed };
      if (
        result.toolCalls.length > MAX_TOOL_CALLS_PER_ROUND
        || totalToolCalls + result.toolCalls.length > MAX_TOTAL_TOOL_CALLS
      ) {
        throw new AdministrativeLimitReached();
      }

      // Model prose is never trusted as content; only allowlisted tool choices
      // are carried into the next selection round.
      if (result.toolCalls.some((call) => this.byteLength(call.function.arguments) > MAX_PROVIDER_TOOL_ARGUMENT_BYTES)) {
        throw new AdministrativeLimitReached();
      }
      messages.push({ role: 'assistant', content: '', toolCalls: result.toolCalls });
      for (const toolCall of result.toolCalls) {
        await assertLeaseHealthy();
        const toolResult = await this.tools.execute(
          toolCall.function.name,
          toolCall.function.arguments,
          context,
        );
        totalToolCalls += 1;
        executions.push({ name: toolCall.function.name, result: toolResult });
        messages.push({
          role: 'tool',
          content: this.truncateUtf8(
            JSON.stringify({ ok: toolResult.ok, data: toolResult.ok ? toolResult.data : toolResult.error }),
            MAX_PROVIDER_TOOL_RESULT_BYTES,
          ),
          tool_call_id: toolCall.id,
        });
      }
    }
    throw new AdministrativeLimitReached();
  }

  private boundedToolDefinitions() {
    const definitions = this.tools.getDefinitions();
    if (this.byteLength(JSON.stringify(definitions)) > MAX_PROVIDER_TOOL_DEFINITION_BYTES) {
      throw new AdministrativeLimitReached();
    }
    return definitions;
  }

  private boundedProviderMessages(messages: ChatMessage[]): ChatMessage[] {
    const system = messages[0];
    if (!system || system.role !== 'system' || this.byteLength(system.content) > MAX_PROVIDER_SYSTEM_PROMPT_BYTES) {
      throw new AdministrativeLimitReached();
    }
    const bounded: ChatMessage[] = [system];
    let used = this.messageBytes(system);
    for (const message of messages.slice(1).reverse()) {
      const bytes = this.messageBytes(message);
      if (used + bytes > MAX_PROVIDER_MESSAGE_BYTES) continue;
      bounded.push(message);
      used += bytes;
    }
    return [bounded[0], ...bounded.slice(1).reverse()];
  }

  private messageBytes(message: ChatMessage): number {
    return MAX_PROVIDER_MESSAGE_ENVELOPE_BYTES
      + this.byteLength(message.content)
      + this.byteLength(message.tool_call_id ?? '')
      + this.byteLength(message.name ?? '')
      + (message.toolCalls?.reduce((total, call) => total
        + this.byteLength(call.id)
        + this.byteLength(call.function.name)
        + this.byteLength(call.function.arguments), 0) ?? 0);
  }

  private byteLength(value: string): number {
    return Buffer.byteLength(value, 'utf8');
  }

  private truncateUtf8(value: string, maxBytes: number): string {
    if (this.byteLength(value) <= maxBytes) return value;
    let result = '';
    for (const character of value) {
      if (this.byteLength(result + character) > maxBytes) break;
      result += character;
    }
    return result;
  }

  private async persistResponse(input: {
    messageId: string;
    conversationId: string;
    body: string;
    metadata: AdministrativePublicMetadata | null;
    kind: ChatMessageKind;
    model: string | null;
    tokensUsed: number;
    latencyMs: number;
    stateVersion: number;
    leaseOwner: string;
    dispatchAttempt: number;
  }): Promise<CommsChatMessage | null> {
    try {
      return await this.rlsTransaction.withTransaction(async (tx) => {
        const existing = await tx.commsChatMessage.findUnique({
          where: { responseForMessageId: input.messageId },
        });
        if (existing) return existing;

        await tx.$queryRaw`
          SELECT "id" FROM "CommsChatMessage"
          WHERE "id" = ${input.messageId}
          FOR UPDATE
        `;
        const inbound = await tx.commsChatMessage.findUnique({
          where: { id: input.messageId },
          select: { conversationId: true, metadata: true },
        });
        const inboundState = inbound ? readAdministrativeMessageState(inbound.metadata) : {};
        if (
          !inbound
          || inbound.conversationId !== input.conversationId
          || readNonNegativeInteger(inboundState.dispatchAttempt) !== input.dispatchAttempt
          || (inboundState.assistantStatus !== 'QUEUED' && inboundState.assistantStatus !== 'RETRYING')
        ) throw new ConversationStatusChanged();

        const conversation = await tx.chatConversation.findUnique({
          where: { id: input.conversationId },
          select: {
            status: true,
            isAiChat: true,
            stateVersion: true,
            assistantLeaseOwner: true,
            assistantLeaseExpiresAt: true,
          },
        });
        const leaseValidAt = new Date();
        if (
          !conversation
          || !this.canUseAi(conversation)
          || conversation.stateVersion !== input.stateVersion
          || conversation.assistantLeaseOwner !== input.leaseOwner
          || !conversation.assistantLeaseExpiresAt
          || conversation.assistantLeaseExpiresAt <= leaseValidAt
        ) throw new ConversationStatusChanged();

        const response = await tx.commsChatMessage.create({
          data: {
            conversationId: input.conversationId,
            senderType: MessageSenderType.AI,
            senderId: null,
            body: input.body,
            kind: input.kind,
            metadata: input.metadata
              ? input.metadata as unknown as Prisma.InputJsonValue
              : Prisma.JsonNull,
            responseForMessageId: input.messageId,
            model: input.model,
            tokensUsed: input.tokensUsed,
            latencyMs: input.latencyMs,
          },
        });
        const operationId = input.metadata?.action === 'CHAT_OPERATION'
          ? input.metadata.operation.id
          : null;
        if (operationId) {
          await tx.chatOperation.updateMany({
            where: { id: operationId, resultMessageId: null },
            data: { resultMessageId: response.id },
          });
        }
        const updated = await tx.chatConversation.updateMany({
          where: {
            id: input.conversationId,
            status: ConversationStatus.AI_ACTIVE,
            isAiChat: true,
            stateVersion: input.stateVersion,
            assistantLeaseOwner: input.leaseOwner,
            assistantLeaseExpiresAt: { gt: leaseValidAt },
          },
          data: { lastMessageAt: new Date(), clientUnreadCount: { increment: 1 } },
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

  private async markRetryableFailure(
    inbound: InboundMessage,
    conversation: ActiveConversation,
    leaseOwner: string,
  ): Promise<boolean> {
    const existingMetadata = this.readApprovedMetadata(inbound.metadata);
    const messageState = readAdministrativeMessageState(inbound.metadata);
    const retryAttempts = this.readRetryAttempts(inbound.metadata);
    const leaseValidAt = new Date();
    try {
      const updated = await this.prisma.commsChatMessage.updateMany({
        where: {
          id: inbound.id,
          conversationId: conversation.id,
          conversation: {
            is: {
              id: conversation.id,
              status: ConversationStatus.AI_ACTIVE,
              isAiChat: true,
              stateVersion: conversation.stateVersion,
              assistantLeaseOwner: leaseOwner,
              assistantLeaseExpiresAt: { gt: leaseValidAt },
            },
          },
        },
        data: {
          metadata: {
            ...existingMetadata,
            assistantStatus: 'RETRYABLE_FAILURE',
            retryable: true,
            retryAttempts,
            dispatchAttempt: readNonNegativeInteger(messageState.dispatchAttempt),
            assistantStateVersion: conversation.stateVersion,
            assistantClientId: conversation.clientId,
          },
        },
      });
      return updated.count === 1;
    } catch {
      this.logger.warn('Could not mark the administrative assistant attempt as retryable');
      return false;
    }
  }

  private async discardUnpublishedOperations(
    messageId: string,
    leaseOwner: string,
    dispatchAttempt: number,
  ): Promise<void> {
    try {
      await this.prisma.chatOperation.deleteMany({
        where: {
          idempotencyKey: {
            startsWith: `chat:${messageId}:`,
            endsWith: `:assistant-execution:${leaseOwner}:${dispatchAttempt}`,
          },
          resultMessageId: null,
        },
      });
    } catch {
      this.logger.warn('Could not discard an administrative operation after the assistant epoch changed');
    }
  }

  private readApprovedMetadata(value: Prisma.JsonValue | null): Partial<AdministrativeHandoffMetadata> {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {};
    const action = value.action === 'OFFER_HANDOFF' ? value.action : undefined;
    const reason = value.reason === 'OUT_OF_SCOPE'
      || value.reason === 'USER_REQUESTED'
      || value.reason === 'LIMIT_REACHED'
      ? value.reason
      : undefined;
    return action && reason ? { action, reason } : {};
  }

  private readRetryAttempts(value: Prisma.JsonValue | null): number {
    if (!value || Array.isArray(value) || typeof value !== 'object') return 0;
    const attempts = value.retryAttempts;
    return typeof attempts === 'number' && Number.isSafeInteger(attempts) && attempts >= 0 ? attempts : 0;
  }

  private hasAssistantFailureMarker(value: Prisma.JsonValue | null): boolean {
    if (!value || Array.isArray(value) || typeof value !== 'object') return false;
    return value.assistantStatus === 'RETRYABLE_FAILURE' || value.assistantStatus === 'RETRYING';
  }

  private async clearRetryableFailure(inbound: InboundMessage): Promise<void> {
    const approved = this.readApprovedMetadata(inbound.metadata);
    try {
      await this.prisma.commsChatMessage.updateMany({
        where: { id: inbound.id, conversationId: inbound.conversationId },
        data: {
          metadata: Object.keys(approved).length > 0
            ? approved as Prisma.InputJsonValue
            : Prisma.JsonNull,
        },
      });
    } catch {
      this.logger.warn('Could not clear an administrative assistant retry marker after success');
    }
  }

  private async findInboundMessage(messageId: string): Promise<InboundMessage | null> {
    const message = await this.prisma.commsChatMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        conversationId: true,
        sequence: true,
        senderType: true,
        body: true,
        metadata: true,
      },
    });
    return message && this.isInboundSender(message.senderType) ? message : null;
  }

  private async findActiveConversation(conversationId: string): Promise<ActiveConversation | null> {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, clientId: true, guestTokenHash: true, language: true, isAiChat: true, status: true, stateVersion: true },
    });
    return conversation && this.canUseAi(conversation) ? conversation : null;
  }

  private findExistingResponse(messageId: string): Promise<CommsChatMessage | null> {
    return this.prisma.commsChatMessage.findUnique({ where: { responseForMessageId: messageId } });
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
