import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { EmbeddingAdapter } from '../../../infrastructure/ai';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import {
  KNOWLEDGE_REINDEX_REQUESTED_EVENT,
  type KnowledgeReindexRequestedPayload,
} from './knowledge-reindex-requested.event';

const CONSUMER_ID = 'ai.knowledge-indexing.v1';
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 100;
const MAX_CHUNKS = 128;
const EMBEDDING_BATCH_SIZE = 16;
const EMBEDDING_TIMEOUT_MS = 35_000;
const LEASE_TTL_MS = 120_000;
const VECTOR_DIMENSION = 1536;

export type KnowledgeIndexErrorCode =
  | 'SOURCE_UNSUPPORTED'
  | 'CONTENT_MISSING'
  | 'CONTENT_TOO_LARGE'
  | 'EMBEDDING_UNAVAILABLE'
  | 'EMBEDDING_FAILED'
  | 'EMBEDDING_INVALID'
  | 'INDEX_WRITE_FAILED';

export class KnowledgeIndexRetryableError extends Error {}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += CHUNK_SIZE - CHUNK_OVERLAP) {
    chunks.push(text.slice(start, Math.min(start + CHUNK_SIZE, text.length)));
  }
  return chunks;
}

function safeErrorCode(error: unknown): KnowledgeIndexErrorCode {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('available') ? 'EMBEDDING_UNAVAILABLE' : 'EMBEDDING_FAILED';
}

@Injectable()
export class KnowledgeIndexingWorker {
  private readonly logger = new Logger(KnowledgeIndexingWorker.name);
  private registered = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rls: RlsTransactionService,
    private readonly embedding: EmbeddingAdapter,
    private readonly eventBus: EventBusService,
  ) {}

  register(): void {
    if (this.registered) return;
    this.registered = true;
    this.eventBus.subscribe<KnowledgeReindexRequestedPayload>(
      KNOWLEDGE_REINDEX_REQUESTED_EVENT,
      CONSUMER_ID,
      (event) => this.execute(event),
    );
  }

  async execute(envelope: DomainEventEnvelope<KnowledgeReindexRequestedPayload>): Promise<void> {
    const { documentId, contentHash } = envelope.payload;
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      select: { id: true, content: true, contentHash: true, sourceType: true, status: true, indexingLeaseOwner: true, indexingLeaseExpiresAt: true },
    });

    if (!document || document.contentHash !== contentHash) return;
    if (document.status === 'EMBEDDED') return;

    const leaseOwner = randomUUID();
    const leaseExpiresAt = new Date(Date.now() + LEASE_TTL_MS);
    const acquired = await this.prisma.knowledgeDocument.updateMany({
      where: {
        id: documentId,
        contentHash,
        status: { not: 'EMBEDDED' },
        OR: [{ indexingLeaseExpiresAt: null }, { indexingLeaseExpiresAt: { lte: new Date() } }],
      },
      data: { indexingLeaseOwner: leaseOwner, indexingLeaseExpiresAt: leaseExpiresAt },
    });
    if (acquired.count !== 1) {
      throw new KnowledgeIndexRetryableError(`Knowledge document ${documentId} is being indexed`);
    }

    if (document.sourceType !== 'manual') {
      await this.markFailed(documentId, contentHash, leaseOwner, 'SOURCE_UNSUPPORTED');
      return;
    }
    if (!document.content?.trim()) {
      await this.markFailed(documentId, contentHash, leaseOwner, 'CONTENT_MISSING');
      return;
    }
    if (!this.embedding.isAvailable()) {
      await this.markFailed(documentId, contentHash, leaseOwner, 'EMBEDDING_UNAVAILABLE');
      throw new Error('EmbeddingAdapter unavailable');
    }

    const chunks = chunkText(document.content);
    if (chunks.length > MAX_CHUNKS) {
      await this.markFailed(documentId, contentHash, leaseOwner, 'CONTENT_TOO_LARGE');
      throw new Error('Knowledge document exceeds indexing limit');
    }
    let vectors: number[][];
    try {
      // Provider work deliberately occurs outside the database transaction.
      vectors = [];
      for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
        const batchVectors = await this.withTimeout(this.embedding.embed(batch), EMBEDDING_TIMEOUT_MS);
        vectors.push(...batchVectors);
      }
      this.assertVectors(vectors, chunks.length);
    } catch (error) {
      const code = error instanceof Error && error.message === 'INVALID_EMBEDDING' ? 'EMBEDDING_INVALID' : safeErrorCode(error);
      await this.markFailed(documentId, contentHash, leaseOwner, code);
      throw error;
    }

    try {
      await this.rls.withTransaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "KnowledgeDocument" WHERE "id" = ${documentId} FOR UPDATE`);
        const current = await tx.knowledgeDocument.findUnique({
          where: { id: documentId },
          select: { contentHash: true, content: true, sourceType: true, indexingLeaseOwner: true },
        });
        if (!current || current.contentHash !== contentHash || current.sourceType !== 'manual' || current.indexingLeaseOwner !== leaseOwner) return;

        await tx.documentChunk.deleteMany({ where: { documentId } });
        await tx.documentChunk.createMany({
          data: chunks.map((content, chunkIndex) => ({
            documentId,
            content,
            chunkIndex,
            indexedContentHash: contentHash,
            tokenCount: Math.ceil(content.length / 4),
          })),
        });
        const indices = chunks.map((_, index) => index);
        const vectorLiterals = vectors.map((vector) => `[${vector.join(',')}]`);
        await tx.$executeRawUnsafe(
          `UPDATE "DocumentChunk" SET embedding = vals.vec::vector
           FROM (SELECT UNNEST($1::int[]) AS idx, UNNEST($2::text[]) AS vec) vals
           WHERE "DocumentChunk"."documentId" = $3 AND "DocumentChunk"."chunkIndex" = vals.idx`,
          indices,
          vectorLiterals,
          documentId,
        );
        await tx.knowledgeDocument.update({
          where: { id: documentId },
          data: { status: 'EMBEDDED', lastIndexedAt: new Date(), lastIndexErrorCode: null, indexingLeaseOwner: null, indexingLeaseExpiresAt: null },
        });
      });
    } catch (error) {
      await this.markFailed(documentId, contentHash, leaseOwner, 'INDEX_WRITE_FAILED');
      throw error;
    }
  }

  private async markFailed(documentId: string, contentHash: string, leaseOwner: string, code: KnowledgeIndexErrorCode): Promise<void> {
    await this.prisma.knowledgeDocument.updateMany({
      where: { id: documentId, contentHash, indexingLeaseOwner: leaseOwner },
      data: { status: 'FAILED', lastIndexErrorCode: code, indexingLeaseOwner: null, indexingLeaseExpiresAt: null },
    });
    this.logger.warn(`Knowledge indexing failed (${code}) for document ${documentId}`);
  }

  private assertVectors(vectors: number[][], expected: number): void {
    if (vectors.length !== expected || vectors.some((vector) => vector.length !== VECTOR_DIMENSION || vector.some((value) => !Number.isFinite(value)))) {
      throw new Error('INVALID_EMBEDDING');
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('Embedding request timed out')), timeoutMs); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export { CONSUMER_ID as KNOWLEDGE_INDEXING_CONSUMER_ID };
