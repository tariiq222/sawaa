import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatAdapter } from './chat.adapter';

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

describe('ChatAdapter', () => {
  let adapter: ChatAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatAdapter,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue({ chatModel: 'test-model', openrouterApiKey: 'key', openrouterBaseUrl: 'http://localhost' }) } },
      ],
    }).compile();

    adapter = module.get<ChatAdapter>(ChatAdapter);
    adapter.onModuleInit();
  });

  it('should be available when api key set', () => {
    expect(adapter.isAvailable()).toBe(true);
  });

  it('should complete chat', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Hello' } }],
      usage: { total_tokens: 10 },
      model: 'test-model',
    });
    (adapter as any).client = { chat: { completions: { create: mockCreate } } };
    const result = await adapter.complete([{ role: 'user', content: 'Hi' }]);
    expect(result.content).toBe('Hello');
  });

  it('should throw when not available', async () => {
    (adapter as any).client = undefined;
    await expect(adapter.complete([{ role: 'user', content: 'Hi' }])).rejects.toThrow();
  });
});
