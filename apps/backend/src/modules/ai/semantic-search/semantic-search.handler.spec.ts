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
            embed: jest.fn().mockResolvedValue([Array.from({ length: 1536 }, () => 0.1)]),
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
    expect((handler as any).prisma.$queryRawUnsafe.mock.calls[0][0]).toContain('kd."isPublished" = true');
  });

  it('should throw when embedding not available', async () => {
    (embedding.isAvailable as jest.Mock).mockReturnValue(false);
    await expect(handler.execute({ query: 'test' })).rejects.toThrow(BadRequestException);
  });

  it('rejects vectors with the wrong pgvector dimension', async () => {
    (embedding.embed as jest.Mock).mockResolvedValue([[0.1, 0.2]]);
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
    const call = prisma.$queryRawUnsafe.mock.calls[0];
    expect(call[0]).toContain('dc."documentId" = $3');
    expect(call.slice(1)).toEqual([expect.any(String), 5, 'd1']);
  });

  it('clamps pagination limits and keeps old/unpublished chunks outside the SQL result', async () => {
    const prisma = (handler as any).prisma;
    await handler.execute({ query: 'test', topK: 0 });
    expect(prisma.$queryRawUnsafe.mock.calls[0][2]).toBe(1);
    const sql = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('kd."isPublished" = true');
    expect(sql).toContain("kd.status = 'EMBEDDED'");
    expect(sql).toContain('dc."indexedContentHash" = kd."contentHash"');
  });
});
