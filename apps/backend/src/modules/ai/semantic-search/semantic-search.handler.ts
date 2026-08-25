import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EmbeddingAdapter } from '../../../infrastructure/ai';
import { SemanticSearchDto, SemanticSearchResult } from './semantic-search.dto';

export type SemanticSearchQuery = SemanticSearchDto;
const VECTOR_DIMENSION = 1536;

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

    // SECURITY: $queryRawUnsafe is used because pgvector's <=> operator
    // requires raw SQL — Prisma has no first-class pgvector support.
    // Injection is prevented by three layers:
    //   1. DTO validation: topK is @IsInt @Max(50); documentId is @IsUUID.
    //   2. topK clamped to [1, 20] again here as defense-in-depth.
    //   3. All user-influenced values pass through $1/$2/$3 parameter
    //      bindings, NOT string interpolation. docFilter is a fixed string
    //      literal chosen from two compile-time constants.
    //   4. vectorLiteral is built from a float[] returned by EmbeddingAdapter
    //      (not user input), and is still passed as $1::vector parameter.
    // Do NOT switch any of $1/$2/$3 to template-literal interpolation.
    const topK = Math.max(1, Math.min(dto.topK ?? 5, 20));
    const [vector] = await this.embedding.embed([dto.query]);
    if (vector.length !== VECTOR_DIMENSION || vector.some((value) => !Number.isFinite(value))) {
      throw new BadRequestException('EmbeddingAdapter returned an invalid vector');
    }
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
       INNER JOIN "KnowledgeDocument" kd ON kd.id = dc."documentId"
       WHERE dc.embedding IS NOT NULL
         AND kd."isPublished" = true
         AND kd.status = 'EMBEDDED'
         AND kd."contentHash" IS NOT NULL
         AND dc."indexedContentHash" = kd."contentHash" ${docFilter}
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
