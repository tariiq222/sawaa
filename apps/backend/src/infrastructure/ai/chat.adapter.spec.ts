import { Test, TestingModule } from '@nestjs/testing';
import { ChatAdapter } from './chat.adapter';
import { AiProviderClientService } from './ai-provider-client.service';
import { AiProvider } from '../../modules/ai/provider-config/ai-provider-config.types';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

describe('ChatAdapter', () => {
  let adapter: ChatAdapter;
  let provider: any;

  beforeEach(async () => {
    mockCreate.mockReset();
    provider = { getReadyClient: jest.fn().mockReturnValue({ client: new (require('openai'))({ apiKey: 'placeholder' }), model: 'deepseek/deepseek-v4-flash-0731', provider: 'OPENROUTER' }), markRetestRequired: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatAdapter,
        { provide: AiProviderClientService, useValue: provider },
      ],
    }).compile();

    adapter = module.get<ChatAdapter>(ChatAdapter);
  });

  it('should be defined', () => expect(adapter).toBeDefined());

  it('should not be available when no API key', async () => {
    provider.getReadyClient.mockReturnValue(null);
    expect(await adapter.isAvailable()).toBe(false);
  });

  it('should be available when API key is set', async () => {
    expect(await adapter.isAvailable()).toBe(true);
  });

  it('should throw when not available on complete', async () => {
    provider.getReadyClient.mockReturnValue(null);
    const noKeyAdapter = adapter;
    await expect(noKeyAdapter.complete([{ role: 'user', content: 'hi' }])).rejects.toThrow('ChatAdapter is not available');
  });

  it('should throw when not available on stream', async () => {
    provider.getReadyClient.mockReturnValue(null);
    const noKeyAdapter = adapter;
    await expect(
      (async () => {
        for await (const _ of noKeyAdapter.stream([{ role: 'user', content: 'hi' }])) { /* no-op */ }
      })()
    ).rejects.toThrow('ChatAdapter is not available');
  });

  it('should complete with default model', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello' } }],
      usage: { total_tokens: 10 },
      model: 'gpt-4',
    });

    const result = await adapter.complete([{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('Hello');
    expect(result.tokensUsed).toBe(10);
    expect(result.model).toBe('gpt-4');
  });

  it('resolves a ready client for every operation', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'ok', tool_calls: [] } }], usage: {}, model: 'gpt-4' });
    await adapter.complete([{ role: 'user', content: 'hi' }]);
    await adapter.completeWithTools([{ role: 'user', content: 'hi' }], []);
    const stream = adapter.stream([{ role: 'user', content: 'hi' }]);
    mockCreate.mockResolvedValue({ [Symbol.asyncIterator]: async function* () { yield { choices: [{ delta: { content: 'ok' } }] }; } });
    for await (const _ of stream) { /* consume */ }
    expect(provider.getReadyClient).toHaveBeenCalledTimes(3);
  });

  it.each([401, 403])('marks provider for retest on %s without logging response data', async (status) => {
    const error = { status, response: { data: 'provider secret body must not be logged' } };
    mockCreate.mockRejectedValue(error);
    await expect(adapter.complete([{ role: 'user', content: 'hi' }])).rejects.toBe(error);
    expect(provider.markRetestRequired).toHaveBeenCalledTimes(1);
    expect((adapter as unknown as { logger?: unknown }).logger).toBeUndefined();
  });

  it('should complete with custom model and maxTokens', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Custom' } }],
      usage: { total_tokens: 5 },
      model: 'custom-model',
    });

    const result = await adapter.complete([{ role: 'user', content: 'hi' }], 'custom-model', { maxTokens: 100 });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'custom-model',
      max_tokens: 100,
    }));
    expect(result.content).toBe('Custom');
  });

  it('should handle empty response content', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: {} }],
      usage: {},
      model: 'gpt-4',
    });

    const result = await adapter.complete([{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('');
    expect(result.tokensUsed).toBe(0);
  });

  it('preserves assistant tool calls when sending tool results in a follow-up round', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Done', tool_calls: [] } }],
      usage: { total_tokens: 4 },
      model: 'gpt-4',
    });

    await adapter.completeWithTools([
      { role: 'user', content: 'List services' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call-1', function: { name: 'listServices', arguments: '{}' } }],
      },
      { role: 'tool', content: '{"ok":true}', tool_call_id: 'call-1' },
    ], []);

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        { role: 'user', content: 'List services' },
        {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'listServices', arguments: '{}' },
          }],
        },
        { role: 'tool', content: '{"ok":true}', tool_call_id: 'call-1' },
      ],
    }));
  });

  it('requires a tool call when tool definitions are supplied', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null, tool_calls: [] } }],
      usage: { total_tokens: 3 },
      model: 'gpt-4',
    });

    await adapter.completeWithTools(
      [{ role: 'user', content: 'السلام عليكم' }],
      [{
        type: 'function',
        function: {
          name: 'replyToCustomer',
          description: 'Return the final customer reply',
          parameters: { type: 'object', properties: {} },
        },
      }],
    );

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      tool_choice: 'required',
    }));
  });

  it('can force one named final-response tool', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null, tool_calls: [] } }],
      usage: { total_tokens: 3 },
      model: 'gpt-4',
    });

    await adapter.completeWithTools(
      [{ role: 'user', content: 'السلام عليكم' }],
      [{
        type: 'function',
        function: {
          name: 'replyToCustomer',
          description: 'Return the final customer reply',
          parameters: { type: 'object', properties: {} },
        },
      }],
      { toolChoice: { type: 'function', function: { name: 'replyToCustomer' } } },
    );

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      tool_choice: { type: 'function', function: { name: 'replyToCustomer' } },
    }));
  });

  it('should stream responses', async () => {
    mockCreate.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { choices: [{ delta: { content: 'Hello' } }] };
        yield { choices: [{ delta: { content: ' world' } }] };
        yield { choices: [{ delta: {} }] };
      },
    });

    const chunks: string[] = [];
    for await (const chunk of adapter.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['Hello', ' world']);
  });

  const ready = (providerName: AiProvider, model: string) => ({
    client: new (require('openai'))({ apiKey: 'placeholder' }),
    model,
    provider: providerName,
  });

  it('does not send thinking for OpenRouter complete, completeWithTools, and stream', async () => {
    provider.getReadyClient.mockReturnValue(ready(AiProvider.OPENROUTER, 'deepseek/deepseek-v4-flash-0731'));
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'ok', tool_calls: [] } }], usage: {}, model: 'deepseek/deepseek-v4-flash-0731' });
    await adapter.complete([{ role: 'user', content: 'hi' }]);
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('thinking');
    await adapter.completeWithTools([{ role: 'user', content: 'hi' }], []);
    expect(mockCreate.mock.calls[1][0]).not.toHaveProperty('thinking');
    mockCreate.mockResolvedValue({ [Symbol.asyncIterator]: async function* () { yield { choices: [{ delta: { content: 'ok' } }] }; } });
    for await (const _ of adapter.stream([{ role: 'user', content: 'hi' }])) { /* consume */ }
    expect(mockCreate.mock.calls[2][0]).not.toHaveProperty('thinking');
  });

  it('sends OpenRouter tools and tool_choice and parses returned tool calls', async () => {
    provider.getReadyClient.mockReturnValue(ready(AiProvider.OPENROUTER, 'deepseek/deepseek-v4-flash-0731'));
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call-openrouter-1',
            type: 'function',
            function: { name: 'replyToCustomer', arguments: '{"text":"ok"}' },
          }],
        },
      }],
      usage: { total_tokens: 7 },
      model: 'deepseek/deepseek-v4-flash-0731',
    });
    const tools = [{
      type: 'function' as const,
      function: {
        name: 'replyToCustomer',
        description: 'Return the final customer reply',
        parameters: { type: 'object', properties: {} },
      },
    }];

    const result = await adapter.completeWithTools(
      [{ role: 'user', content: 'السلام عليكم' }],
      tools,
      { toolChoice: { type: 'function', function: { name: 'replyToCustomer' } } },
    );

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'deepseek/deepseek-v4-flash-0731',
      tools,
      tool_choice: { type: 'function', function: { name: 'replyToCustomer' } },
    }));
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('thinking');
    expect(result.toolCalls).toEqual([{
      id: 'call-openrouter-1',
      function: { name: 'replyToCustomer', arguments: '{"text":"ok"}' },
    }]);
    expect(result.content).toBeNull();
    expect(result.model).toBe('deepseek/deepseek-v4-flash-0731');
  });
});
