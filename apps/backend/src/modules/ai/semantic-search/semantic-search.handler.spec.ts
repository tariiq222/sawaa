import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SemanticSearchHandler } from './semantic-search.handler';
import { PrismaService } from '../../../infrastructure/database';
import { EmbeddingAdapter } from '../../../infrastructure/ai';

describe('SemanticSearchHandler', () => {
  let handler: SemanticSearchHandler;
  let embedding: EmbeddingAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SemanticSearchHandler,
        {
          provide: PrismaService,
          useValue: {
            $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: '1', documentId: 'd1', content: 'Test', chunkIndex: 0, similarity: 0.9 }]),
          },
        },
        {
          provide: EmbeddingAdapter,
          useValue: {
            isAvailable: jest.fn().mockReturnValue(true),
            embed: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
          },
        },
      ],
    }).compile();

    handler = module.get<SemanticSearchHandler>(SemanticSearchHandler);
    embedding = module.get<EmbeddingAdapter>(EmbeddingAdapter);
  });

  it('should search', async () => {
    const result = await handler.execute({ query: 'test' });
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Test');
  });

  it('should throw when embedding not available', async () => {
    (embedding.isAvailable as jest.Mock).mockReturnValue(false);
    await expect(handler.execute({ query: 'test' })).rejects.toThrow(BadRequestException);
  });

  it('should search with document filter', async () => {
    const prisma = (handler as any).prisma;
    await handler.execute({ query: 'test', documentId: 'd1' });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('documentId'),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });
});
