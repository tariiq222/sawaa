import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { AiConfig } from './ai.config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface CompletionResult {
  content: string;
  tokensUsed: number;
  model: string;
}

export type ToolDefinition = ChatCompletionTool;

export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export interface CompletionWithToolsResult {
  content: string | null;
  toolCalls: ToolCall[];
  tokensUsed: number;
  model: string;
}

interface IChatService {
  complete(messages: ChatMessage[], model?: string, options?: { maxTokens?: number }): Promise<CompletionResult>;
  completeWithTools(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    options?: { model?: string; maxTokens?: number; temperature?: number },
  ): Promise<CompletionWithToolsResult>;
  stream(messages: ChatMessage[], model?: string): AsyncIterable<string>;
  isAvailable(): boolean;
}

@Injectable()
export class ChatAdapter implements IChatService, OnModuleInit {
  private readonly logger = new Logger(ChatAdapter.name);
  private client?: OpenAI;
  private defaultModel: string;

  constructor(private readonly config: ConfigService) {
    const cfg = this.config.get<AiConfig>('ai')!;
    this.defaultModel = cfg.chatModel;
  }

  onModuleInit(): void {
    const cfg = this.config.get<AiConfig>('ai')!;
    if (!cfg.openrouterApiKey) {
      this.logger.warn('OPENROUTER_API_KEY not set — ChatAdapter disabled');
      return;
    }
    this.client = new OpenAI({
      apiKey: cfg.openrouterApiKey,
      baseURL: cfg.openrouterBaseUrl,
      defaultHeaders: {
        'HTTP-Referer': 'https://sawaa.app',
        'X-Title': 'Sawaa AI',
      },
    });
    this.logger.log(`ChatAdapter ready (model: ${this.defaultModel})`);
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  private toOpenAIMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
    return messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.tool_call_id ?? '',
        };
      }
      if (m.role === 'assistant') {
        return { role: 'assistant', content: m.content };
      }
      if (m.role === 'system') {
        return { role: 'system', content: m.content };
      }
      return { role: 'user', content: m.content };
    });
  }

  async complete(messages: ChatMessage[], model?: string, options?: { maxTokens?: number }): Promise<CompletionResult> {
    if (!this.client) throw new Error('ChatAdapter is not available — set OPENROUTER_API_KEY');
    const response = await this.client.chat.completions.create({
      model: model ?? this.defaultModel,
      messages: this.toOpenAIMessages(messages),
      ...(options?.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
    });
    return {
      content: response.choices[0]?.message?.content ?? '',
      tokensUsed: response.usage?.total_tokens ?? 0,
      model: response.model ?? model ?? this.defaultModel,
    };
  }

  async completeWithTools(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    options?: { model?: string; maxTokens?: number; temperature?: number },
  ): Promise<CompletionWithToolsResult> {
    if (!this.client) throw new Error('ChatAdapter is not available — set OPENROUTER_API_KEY');
    const response = await this.client.chat.completions.create({
      model: options?.model ?? this.defaultModel,
      messages: this.toOpenAIMessages(messages),
      tools,
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options?.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
    });
    const message = response.choices[0]?.message;
    const toolCalls: ToolCall[] = [];
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
      model: response.model ?? options?.model ?? this.defaultModel,
    };
  }

  async *stream(messages: ChatMessage[], model?: string): AsyncIterable<string> {
    if (!this.client) throw new Error('ChatAdapter is not available — set OPENROUTER_API_KEY');
    const streamResult = await this.client.chat.completions.create({
      model: model ?? this.defaultModel,
      messages: this.toOpenAIMessages(messages),
      stream: true,
    });
    for await (const chunk of streamResult) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
