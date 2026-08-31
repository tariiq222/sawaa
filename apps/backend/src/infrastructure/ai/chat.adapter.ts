import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionCreateParams, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { AiProvider } from '../../modules/ai/provider-config/ai-provider-config.types';
import { AiProviderClientService } from './ai-provider-client.service';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  toolCalls?: ToolCall[];
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

export type ToolChoice = 'required' | {
  type: 'function';
  function: { name: string };
};

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
    options?: { model?: string; maxTokens?: number; temperature?: number; toolChoice?: ToolChoice },
  ): Promise<CompletionWithToolsResult>;
  stream(messages: ChatMessage[], model?: string): AsyncIterable<string>;
  isAvailable(): Promise<boolean>;
}

@Injectable()
export class ChatAdapter implements IChatService {
  constructor(private readonly providerClient: AiProviderClientService) {}

  async isAvailable(): Promise<boolean> {
    try { return (await this.providerClient.getReadyClient()) !== null; } catch { return false; }
  }

  private async ready(): Promise<{ client: OpenAI; model: string; provider: AiProvider }> {
    const resolved = await this.providerClient.getReadyClient();
    if (!resolved) throw new Error('ChatAdapter is not available — configure and test an AI provider');
    return resolved;
  }

  private async providerError(error: unknown): Promise<never> {
    const status = typeof error === 'object' && error !== null
      ? ((error as { status?: number; response?: { status?: number } }).status ?? (error as { response?: { status?: number } }).response?.status)
      : undefined;
    if (status === 401 || status === 403) await this.providerClient.markRetestRequired();
    throw error;
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
        return {
          role: 'assistant',
          content: m.content,
          ...(m.toolCalls?.length
            ? {
                tool_calls: m.toolCalls.map((call) => ({
                  id: call.id,
                  type: 'function' as const,
                  function: call.function,
                })),
              }
            : {}),
        };
      }
      if (m.role === 'system') {
        return { role: 'system', content: m.content };
      }
      return { role: 'user', content: m.content };
    });
  }

  async complete(messages: ChatMessage[], model?: string, options?: { maxTokens?: number }): Promise<CompletionResult> {
    const ready = await this.ready();
    let response;
    try {
      const body: ChatCompletionCreateParams = { model: model ?? ready.model, messages: this.toOpenAIMessages(messages), ...(options?.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}) };
      response = await ready.client.chat.completions.create(body);
    } catch (error) { return this.providerError(error); }
    return {
      content: response.choices[0]?.message?.content ?? '',
      tokensUsed: response.usage?.total_tokens ?? 0,
      model: response.model ?? model ?? ready.model,
    };
  }

  async completeWithTools(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    options?: { model?: string; maxTokens?: number; temperature?: number; toolChoice?: ToolChoice },
  ): Promise<CompletionWithToolsResult> {
    const ready = await this.ready();
    let response;
    try {
      const body: ChatCompletionCreateParams = { model: options?.model ?? ready.model, messages: this.toOpenAIMessages(messages), tools, ...(tools.length > 0 ? { tool_choice: options?.toolChoice ?? 'required' as const } : {}), ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}), ...(options?.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}) };
      response = await ready.client.chat.completions.create(body);
    } catch (error) { return this.providerError(error); }
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
      model: response.model ?? options?.model ?? ready.model,
    };
  }

  async *stream(messages: ChatMessage[], model?: string): AsyncIterable<string> {
    const ready = await this.ready();
    try {
      const body: ChatCompletionCreateParams = { model: model ?? ready.model, messages: this.toOpenAIMessages(messages), stream: true };
      const streamResult = await ready.client.chat.completions.create(body);
      for await (const chunk of streamResult) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    } catch (error) { await this.providerError(error); }
  }
}
