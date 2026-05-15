import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingAdapter } from './embedding.adapter';

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    },
  }));
});

describe('EmbeddingAdapter', () => {
  let adapter: EmbeddingAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingAdapter,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue({ embeddingModel: 'test-model', openaiApiKey: 'key' }) } },
      ],
    }).compile();

    adapter = module.get<EmbeddingAdapter>(EmbeddingAdapter);
    adapter.onModuleInit();
  });

  it('should be available', () => {
    expect(adapter.isAvailable()).toBe(true);
  });

  it('should embed texts', async () => {
    const result = await adapter.embed(['hello', 'world']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([0.1, 0.2, 0.3]);
  });

  it('should throw when not available', async () => {
    (adapter as any).client = undefined;
    await expect(adapter.embed(['hello'])).rejects.toThrow('EmbeddingAdapter is not available');
  });

  it('should warn when no api key', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingAdapter,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue({ embeddingModel: 'test-model', openaiApiKey: '' }) } },
      ],
    }).compile();
    const a = module.get<EmbeddingAdapter>(EmbeddingAdapter);
    a.onModuleInit();
    expect(a.isAvailable()).toBe(false);
  });
});
