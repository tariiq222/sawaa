import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatAdapter } from './chat.adapter';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

describe('ChatAdapter', () => {
  let adapter: ChatAdapter;
  let config: any;

  beforeEach(async () => {
    mockCreate.mockReset();
    config = {
      get: jest.fn().mockReturnValue({
        chatModel: 'gpt-4',
        openrouterApiKey: 'test-key',
        openrouterBaseUrl: 'https://api.openrouter.com',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatAdapter,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    adapter = module.get<ChatAdapter>(ChatAdapter);
    adapter.onModuleInit();
  });

  it('should be defined', () => expect(adapter).toBeDefined());

  it('should not be available when no API key', () => {
    config.get.mockReturnValue({ chatModel: 'gpt-4', openrouterApiKey: '' });
    const noKeyAdapter = new ChatAdapter(config);
    noKeyAdapter.onModuleInit();
    expect(noKeyAdapter.isAvailable()).toBe(false);
  });

  it('should be available when API key is set', () => {
    expect(adapter.isAvailable()).toBe(true);
  });

  it('should throw when not available on complete', async () => {
    config.get.mockReturnValue({ chatModel: 'gpt-4', openrouterApiKey: '' });
    const noKeyAdapter = new ChatAdapter(config);
    noKeyAdapter.onModuleInit();
    await expect(noKeyAdapter.complete([{ role: 'user', content: 'hi' }])).rejects.toThrow('ChatAdapter is not available');
  });

  it('should throw when not available on stream', async () => {
    config.get.mockReturnValue({ chatModel: 'gpt-4', openrouterApiKey: '' });
    const noKeyAdapter = new ChatAdapter(config);
    noKeyAdapter.onModuleInit();
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
});
