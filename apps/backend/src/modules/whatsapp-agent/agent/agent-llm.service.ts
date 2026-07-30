// agent-llm.service — wraps the OpenAI-compatible completion API for the
// WhatsApp agent. Reads the API key from the singleton WhatsappAgentConfig
// row at runtime (encrypted with the WhatsApp encryption key), so the
// operator can rotate it from the dashboard without restarting the backend.
//
// Falls back to the OPENROUTER_API_KEY env var when no key is stored in the
// DB (matches the existing chat surface's behavior).

import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../../../infrastructure/database';
import { WhatsappCredentialsService } from '../../../infrastructure/whatsapp/whatsapp-credentials.service';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export interface AgentCompletionInput {
  model: string;
  temperature: number;
  maxTokens: number;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
    name?: string;
    tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
  }>;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

export interface AgentCompletionResult {
  content: string | null;
  toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>;
  tokensUsed: number;
  model: string;
}

@Injectable()
export class AgentLlmService {
  private readonly logger = new Logger(AgentLlmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: WhatsappCredentialsService,
  ) {}

  /**
   * Resolves the OpenRouter API key from the singleton config row, falling
   * back to the OPENROUTER_API_KEY env var. Returns null when neither is set.
   */
  async resolveApiKey(): Promise<string | null> {
    const config = await this.prisma.whatsappAgentConfig.findFirst();
    if (config?.aiApiKeyEncrypted) {
      try {
        const stored = this.credentials.decrypt<{ aiApiKey?: string }>(
          config.aiApiKeyEncrypted,
          DEFAULT_ORG_ID,
        );
        if (stored.aiApiKey) return stored.aiApiKey;
      } catch (e: unknown) {
        this.logger.warn(
          `Failed to decrypt aiApiKeyEncrypted: ${e instanceof Error ? e.message : 'unknown'}`,
        );
      }
    }
    return process.env.OPENROUTER_API_KEY || null;
  }

  async complete(input: AgentCompletionInput): Promise<AgentCompletionResult> {
    const apiKey = await this.resolveApiKey();
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured. Set it in /settings/whatsapp → AI tab.');
    }

    const client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://sawaa.app',
        'X-Title': 'Sawaa WhatsApp Agent',
      },
    });

    const params: Parameters<typeof client.chat.completions.create>[0] = {
      model: input.model,
      messages: input.messages.map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'tool',
            content: m.content,
            tool_call_id: m.tool_call_id ?? '',
          } as never;
        }
        if (m.role === 'assistant') {
          return {
            role: 'assistant',
            content: m.content,
            ...(m.tool_calls ? {
              tool_calls: m.tool_calls.map((call) => ({ ...call, type: 'function' as const })),
            } : {}),
          };
        }
        if (m.role === 'system') {
          return { role: 'system', content: m.content };
        }
        return { role: 'user', content: m.content };
      }) as never,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
    };

    if (input.tools && input.tools.length > 0) {
      (params as { tools?: unknown }).tools = input.tools;
    }

    const response = (await client.chat.completions.create(
      params as never,
    )) as {
      choices: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
      usage?: { total_tokens?: number };
      model?: string;
    };
    const message = response.choices[0]?.message;
    const toolCalls: AgentCompletionResult['toolCalls'] = [];
    for (const tc of message?.tool_calls ?? []) {
      if (tc.type === 'function') {
        toolCalls.push({
          id: tc.id,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        });
      }
    }

    return {
      content: message?.content ?? null,
      toolCalls,
      tokensUsed: response.usage?.total_tokens ?? 0,
      model: response.model ?? input.model,
    };
  }
}
