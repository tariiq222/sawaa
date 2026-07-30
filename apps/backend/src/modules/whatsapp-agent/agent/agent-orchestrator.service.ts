// agent-orchestrator — main entry point for handling an inbound WhatsApp
// message. It:
//   1. Resolves the conversation (creates one if missing).
//   2. Persists the user message.
//   3. Builds the prompt (system + history + user).
//   4. Calls ChatAdapter with tools.
//   5. Executes any tool calls in a loop (max 4 turns).
//   6. Persists the assistant reply.
//   7. Sends the reply via Evolution API.
//
// IMPORTANT: this is fire-and-forget from the webhook's perspective — the
// webhook returns 200 immediately and the orchestrator runs in the
// background. Errors are logged but never rethrow.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { WhatsappTransportService } from '../../../infrastructure/whatsapp/whatsapp-transport.service';
import { BookingToolsService } from './booking-tools.service';
import { AgentLlmService } from './agent-llm.service';

const MAX_TOOL_TURNS = 4;
const MAX_HISTORY_MESSAGES = 20;

type OrchestratorMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
};

@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: AgentLlmService,
    private readonly tools: BookingToolsService,
    private readonly transport: WhatsappTransportService,
  ) {}

  async handleInbound(
    phone: string,
    text: string,
    externalMessageId?: string,
  ): Promise<void> {
    const config = await this.prisma.whatsappAgentConfig.findFirst();
    if (!config || !config.isActive) {
      this.logger.warn(`Agent inactive or not configured, dropping ${phone}`);
      return;
    }

    // 1. Find or create the conversation.
    const conversation = await this.prisma.whatsappConversation.upsert({
      where: { phone },
      create: {
        phone,
        status: 'ACTIVE',
        language: config.defaultLanguage,
        lastMessageAt: new Date(),
      },
      update: {
        lastMessageAt: new Date(),
      },
    });

    // Guard: if a staff member is in takeover, the agent must stay silent.
    if (conversation.staffTakeover) {
      this.logger.log(`Conversation ${conversation.id} under staff takeover, skipping`);
      return;
    }

    // 2. Resume a replay from persisted state, or persist the inbound message.
    const persistedUserMessage = externalMessageId
      ? await this.prisma.whatsappMessage.findUnique({
          where: { externalMessageId },
        })
      : null;
    const userMessage = persistedUserMessage ?? await this.prisma.whatsappMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: text,
        externalMessageId: externalMessageId ?? null,
      },
    });

    const pendingReply = externalMessageId
      ? await this.prisma.whatsappMessage.findFirst({
          where: { inReplyToExternalMessageId: externalMessageId },
        })
      : null;
    if (pendingReply) {
      if (pendingReply.deliveryStatus === 'SENT') return;
      if (pendingReply.errorMessage === 'STAFF_TAKEOVER') return;
      await this.deliverReply(
        conversation.id,
        phone,
        pendingReply.id,
        pendingReply.content,
        config.id,
      );
      return;
    }

    // 3. Build messages.
    const history = await this.prisma.whatsappMessage.findMany({
      where: { conversationId: conversation.id, id: { not: userMessage.id } },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_MESSAGES,
      select: { role: true, content: true, toolCalls: true, toolResults: true },
    });
    history.reverse();

    const systemPrompt = this.buildSystemPrompt(
      config.systemPromptAr,
      config.systemPromptEn,
      config.defaultLanguage,
      config.greetingAr,
      config.greetingEn,
    );

    const messages: OrchestratorMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history
        .filter((m) => m.role !== 'TOOL' && m.role !== 'SYSTEM')
        .map<OrchestratorMessage>((m) => ({
          role: m.role === 'ASSISTANT' ? 'assistant' : 'user',
          content: m.content,
        })),
      { role: 'user', content: text },
    ];

    // 4. Tool-calling loop.
    const toolDefs = this.tools.listTools();
    let totalTokens = 0;
    let finalReply: string | null = null;
    let lastError: string | null = null;

    if (await this.isOutsideBusinessHours(config.businessHoursOnly, config.activeDays)) {
      finalReply = config.defaultLanguage === 'en'
        ? 'Thank you for contacting Sawa. We are currently outside business hours and will respond when the center reopens.'
        : 'شكراً لتواصلك مع مركز سواء. نحن الآن خارج ساعات العمل وسنرد عليك عند عودة الدوام.';
    } else {
      const apiKey = await this.llm.resolveApiKey();
      if (!apiKey) {
        lastError = 'OpenRouter API key is not configured';
        finalReply = config.defaultLanguage === 'en'
          ? 'Sorry, the automated assistant is temporarily unavailable. A team member will help you soon.'
          : 'عذراً، المساعد الآلي غير متاح مؤقتاً. سيساعدك أحد أعضاء الفريق قريباً.';
      } else {
        for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
          try {
            const result = await this.llm.complete({
              model: config.aiModel,
              temperature: config.aiTemperature,
              maxTokens: config.aiMaxTokens,
              messages,
              tools: toolDefs,
            });
            totalTokens += result.tokensUsed;

            if (result.toolCalls.length === 0) {
              finalReply = result.content ?? '';
              break;
            }

            messages.push({
              role: 'assistant',
              content: result.content ?? '',
              tool_calls: result.toolCalls,
            });

            for (const call of result.toolCalls) {
              let toolResult: unknown;
              try {
                const args = this.parseJson(call.function.arguments);
                toolResult = await this.tools.execute(call.function.name, args, { phone });
              } catch (e: unknown) {
                const message = e instanceof Error ? e.message : 'tool error';
                toolResult = { error: message };
              }

              messages.push({
                role: 'tool',
                tool_call_id: call.id,
                name: call.function.name,
                content: JSON.stringify(toolResult),
              });
            }
          } catch (e: unknown) {
            lastError = e instanceof Error ? e.message : 'unknown';
            this.logger.warn(`LLM call failed: ${lastError}`);
            break;
          }
        }
      }
    }

    if (finalReply === null) {
      finalReply = lastError
        ? 'عذراً، المساعد الآلي غير متاح الآن. حاول مرة أخرى لاحقاً.'
        : 'عذراً، حدث خطأ. حاول مرة ثانية.';
    }

    // 5. Persist the assistant reply.
    const assistantLatencyMs = Date.now() - userMessage.createdAt.getTime();
    const assistantMessage = await this.prisma.whatsappMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: finalReply,
        tokenUsage: totalTokens,
        latencyMs: assistantLatencyMs,
        inReplyToExternalMessageId: externalMessageId ?? null,
        deliveryStatus: 'PENDING',
      },
    });

    // 6. Send via Evolution API and persist delivery state for safe retries.
    await this.deliverReply(
      conversation.id,
      phone,
      assistantMessage.id,
      finalReply,
      config.id,
    );
  }

  private async deliverReply(
    conversationId: string,
    phone: string,
    messageId: string,
    text: string,
    configId: string,
  ): Promise<void> {
    const latestConversation = await this.prisma.whatsappConversation.findUnique({
      where: { id: conversationId },
      select: { staffTakeover: true },
    });
    if (latestConversation?.staffTakeover) {
      this.logger.log(`Conversation ${conversationId} entered staff takeover before send`);
      await this.prisma.whatsappMessage.update({
        where: { id: messageId },
        data: { deliveryStatus: 'FAILED', errorMessage: 'STAFF_TAKEOVER' },
      });
      return;
    }

    try {
      const { client } = await this.transport.resolve();
      const result = await client.sendText({ number: phone, text });
      if (!result.ok) throw new Error(result.error ?? 'Evolution rejected the message');

      await this.prisma.whatsappMessage.update({
        where: { id: messageId },
        data: {
          deliveryStatus: 'SENT',
          providerMessageId: result.messageId ?? result.external ?? null,
          errorMessage: null,
        },
      });
      await this.prisma.whatsappAgentConfig.update({
        where: { id: configId },
        data: {
          messagesCount: { increment: 1 },
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown';
      await this.prisma.whatsappMessage.update({
        where: { id: messageId },
        data: { deliveryStatus: 'FAILED', errorMessage: message.slice(0, 500) },
      });
      await this.prisma.whatsappAgentConfig.update({
        where: { id: configId },
        data: { lastErrorAt: new Date(), lastErrorMessage: message.slice(0, 500) },
      });
      throw error;
    }
  }

  private buildSystemPrompt(
    ar: string,
    en: string,
    defaultLang: string,
    greetingAr: string | null,
    greetingEn: string | null,
  ): string {
    const greeting = defaultLang === 'en' ? greetingEn : greetingAr;
    const base = defaultLang === 'en' ? en : ar;
    const greetingLine = greeting ? `Greeting to use for first contact: "${greeting}".\n` : '';
    return (
      greetingLine +
      base +
      `

لغة افتراضية: ${defaultLang === 'en' ? 'English' : 'العربية'}.
رد بنفس لغة العميل. إذا كتب بالعربية رد بالعربية، إذا كتب بالإنجليزية رد بالإنجليزية.
لا تخترع مواعيد أو مستشارين غير موجودين — استخدم الأدوات دائماً.
عند إكمال الحجز، اشكر العميل وأكد له أن الموظف سيتواصل خلال دقائق.`
    );
  }

  private async isOutsideBusinessHours(
    businessHoursOnly: boolean,
    activeDays: number[],
  ): Promise<boolean> {
    if (!businessHoursOnly) return false;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Riyadh',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday'));
    if (!activeDays.includes(dayOfWeek)) return true;

    const now = `${value('hour')}:${value('minute')}`;
    const hours = await this.prisma.businessHour.findMany({
      where: { dayOfWeek, isOpen: true },
      select: { startTime: true, endTime: true },
    });
    return !hours.some(({ startTime, endTime }) =>
      startTime <= endTime
        ? now >= startTime && now < endTime
        : now >= startTime || now < endTime,
    );
  }

  private parseJson(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
}
