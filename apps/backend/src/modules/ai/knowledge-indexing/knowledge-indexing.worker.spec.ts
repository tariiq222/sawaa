import { KnowledgeIndexingWorker } from './knowledge-indexing.worker';
import { KNOWLEDGE_REINDEX_REQUESTED_EVENT } from './knowledge-reindex-requested.event';

const envelope = (hash = 'hash-1') => ({
  eventId: 'event-1', source: 'ai', version: 1, occurredAt: new Date(),
  payload: { documentId: 'doc-1', contentHash: hash },
});

function fixture() {
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    knowledgeDocument: { findUnique: jest.fn(), update: jest.fn() },
    documentChunk: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma: any = {
    knowledgeDocument: { findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const rls = { withTransaction: jest.fn((fn: (tx: any) => unknown) => fn(tx)) };
  const embedding = { isAvailable: jest.fn().mockReturnValue(true), embed: jest.fn().mockResolvedValue([Array.from({ length: 1536 }, () => 0.1)]) };
  const eventBus = { subscribe: jest.fn() };
  return { tx, prisma, rls, embedding, eventBus, worker: new KnowledgeIndexingWorker(prisma, rls as any, embedding as any, eventBus as any) };
}

describe('KnowledgeIndexingWorker', () => {
  it('registers one explicit durable consumer for the versioned event', () => {
    const f = fixture();
    f.worker.register();
    expect(f.eventBus.subscribe).toHaveBeenCalledWith(
      KNOWLEDGE_REINDEX_REQUESTED_EVENT,
      'ai.knowledge-indexing.v1',
      expect.any(Function),
    );
  });

  it('supersedes stale events without calling the provider or mutating chunks', async () => {
    const f = fixture();
    f.prisma.knowledgeDocument.findUnique.mockResolvedValue({ contentHash: 'new-hash', status: 'PENDING' });
    await f.worker.execute(envelope('old-hash') as any);
    expect(f.embedding.embed).not.toHaveBeenCalled();
    expect(f.rls.withTransaction).not.toHaveBeenCalled();
  });

  it('is idempotent for an already embedded document', async () => {
    const f = fixture();
    f.prisma.knowledgeDocument.findUnique.mockResolvedValue({ contentHash: 'hash-1', status: 'EMBEDDED' });
    await f.worker.execute(envelope() as any);
    expect(f.embedding.embed).not.toHaveBeenCalled();
  });

  it('defers when another active lease owns the same content version', async () => {
    const f = fixture();
    f.prisma.knowledgeDocument.findUnique.mockResolvedValue({ contentHash: 'hash-1', status: 'PENDING', indexingLeaseExpiresAt: new Date(Date.now() + 30_000) });
    f.prisma.knowledgeDocument.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.worker.execute(envelope() as any)).rejects.toThrow('being indexed');
    expect(f.embedding.embed).not.toHaveBeenCalled();
  });

  it('replaces chunks only after embedding and records the indexed content hash', async () => {
    const f = fixture();
    f.prisma.knowledgeDocument.findUnique.mockResolvedValueOnce({ contentHash: 'hash-1', status: 'PENDING', sourceType: 'manual', content: 'hello' });
    f.tx.knowledgeDocument.findUnique.mockImplementation(async () => ({ contentHash: 'hash-1', sourceType: 'manual', content: 'hello', indexingLeaseOwner: (f.prisma.knowledgeDocument.updateMany as jest.Mock).mock.calls[0]?.[0]?.data.indexingLeaseOwner }));
    await f.worker.execute(envelope() as any);
    expect(f.embedding.embed).toHaveBeenCalledWith(['hello']);
    expect(f.tx.documentChunk.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'doc-1' } });
    expect(f.tx.documentChunk.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ indexedContentHash: 'hash-1' })] });
    expect(f.tx.knowledgeDocument.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'EMBEDDED' }) }));
  });

  it('stores a safe failure code and rethrows provider failures for queue retry', async () => {
    const f = fixture();
    f.prisma.knowledgeDocument.findUnique.mockResolvedValue({ contentHash: 'hash-1', status: 'PENDING', sourceType: 'manual', content: 'hello' });
    f.embedding.embed.mockRejectedValue(new Error('provider body secret should not persist'));
    await expect(f.worker.execute(envelope() as any)).rejects.toThrow('provider body secret');
    expect(f.prisma.knowledgeDocument.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'doc-1', contentHash: 'hash-1', indexingLeaseOwner: expect.any(String) },
      data: { status: 'FAILED', lastIndexErrorCode: 'EMBEDDING_FAILED', indexingLeaseOwner: null, indexingLeaseExpiresAt: null },
    }));
  });

  it('rejects malformed provider vectors before opening the replacement transaction', async () => {
    const f = fixture();
    f.prisma.knowledgeDocument.findUnique.mockResolvedValue({ contentHash: 'hash-1', status: 'PENDING', sourceType: 'manual', content: 'hello' });
    f.embedding.embed.mockResolvedValue([[0.1, Number.NaN]]);
    await expect(f.worker.execute(envelope() as any)).rejects.toThrow('INVALID_EMBEDDING');
    expect(f.rls.withTransaction).not.toHaveBeenCalled();
    expect(f.prisma.knowledgeDocument.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ lastIndexErrorCode: 'EMBEDDING_INVALID' }) }));
  });

  it('does not fetch unsupported URL sources', async () => {
    const f = fixture();
    f.prisma.knowledgeDocument.findUnique.mockResolvedValue({ contentHash: 'hash-1', status: 'PENDING', sourceType: 'url', content: 'https://example.com' });
    await f.worker.execute(envelope() as any);
    expect(f.embedding.embed).not.toHaveBeenCalled();
    expect(f.prisma.knowledgeDocument.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lastIndexErrorCode: 'SOURCE_UNSUPPORTED' }) }));
  });
});
