import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EmbeddingAdapter } from '../../../infrastructure/ai';
import { SemanticSearchDto, SemanticSearchResult } from './semantic-search.dto';

export type SemanticSearchQuery = SemanticSearchDto;

@Injectable()
export class SemanticSearchHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingAdapter,
  ) {}

  async execute(dto: SemanticSearchQuery): Promise<SemanticSearchResult[]> {
    if (!this.embedding.isAvailable()) {
      throw new BadRequestException('EmbeddingAdapter is not available — set OPENAI_API_KEY');
    }

    const topK = Math.min(dto.topK ?? 5, 20);
    const [vector] = await this.embedding.embed([dto.query]);
    const vectorLiteral = `[${vector.join(',')}]`;

    const docFilter = dto.documentId ? `AND dc."documentId" = $3` : '';
    const params: unknown[] = [vectorLiteral, topK];
    if (dto.documentId) params.push(dto.documentId);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: string; documentId: string; content: string; chunkIndex: number; similarity: number }>
    >(
      `SELECT dc.id, dc."documentId", dc.content, dc."chunkIndex",
              1 - (dc.embedding <=> $1::vector) AS similarity
       FROM "DocumentChunk" dc
       WHERE dc.embedding IS NOT NULL ${docFilter}
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $2`,
      ...params,
    );

    return rows.map((r) => ({
      chunkId: r.id,
      documentId: r.documentId,
      content: r.content,
      chunkIndex: r.chunkIndex,
      similarity: Number(r.similarity),
    }));
  }
}
