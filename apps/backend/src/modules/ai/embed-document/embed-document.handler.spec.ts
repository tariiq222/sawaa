import { EmbedDocumentHandler } from './embed-document.handler';

const futureDoc = { id: 'doc-1', title: 'Test', status: 'PENDING' };

type MockPrisma = {
  knowledgeDocument: { create: jest.Mock; update: jest.Mock };
  documentChunk: { createMany: jest.Mock };
  $executeRawUnsafe: jest.Mock;
  $transaction: jest.Mock;
};

const mockPrisma = (): MockPrisma => {
  const p: MockPrisma = {
    knowledgeDocument: {
      create: jest.fn().mockResolvedValue(futureDoc),
      update: jest.fn().mockResolvedValue({ ...futureDoc, status: 'EMBEDDED' }),
    },
    documentChunk: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(),
  };
  p.$transaction.mockImplementation(async (fn: (tx: MockPrisma) => Promise<unknown>) => fn(p));
  return p;
};

const mockRlsTransaction = (prisma: MockPrisma) => ({
  withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
});

const mockEmbedding = () => ({
  isAvailable: jest.fn().mockReturnValue(true),
  embed: jest.fn().mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]),
});

const dto = {
  title: 'Sawaa FAQ',
  content: 'A'.repeat(3000),
  sourceType: 'manual' as const,
};

describe('EmbedDocumentHandler', () => {
  it('creates document record with PENDING status then updates to EMBEDDED', async () => {
    const prisma = mockPrisma();
    const embedding = mockEmbedding();
    const handler = new EmbedDocumentHandler(prisma as never, mockRlsTransaction(prisma) as never, embedding as never);
    await handler.execute(dto);
    expect(prisma.knowledgeDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }),
    );
    expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EMBEDDED' }) }),
    );
  });

  it('calls embed once per chunk batch', async () => {
    const prisma = mockPrisma();
    const embedding = mockEmbedding();
    const handler = new EmbedDocumentHandler(prisma as never, mockRlsTransaction(prisma) as never, embedding as never);
    await handler.execute(dto);
    expect(embedding.embed).toHaveBeenCalledTimes(1);
    const chunks: string[] = embedding.embed.mock.calls[0][0];
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('marks document as FAILED when embedding throws', async () => {
    const prisma = mockPrisma();
    const embedding = mockEmbedding();
    embedding.embed = jest.fn().mockRejectedValue(new Error('API error'));
    const handler = new EmbedDocumentHandler(prisma as never, mockRlsTransaction(prisma) as never, embedding as never);
    await expect(handler.execute(dto)).rejects.toThrow('API error');
    expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('throws if EmbeddingAdapter is not available', async () => {
    const prisma = mockPrisma();
    const embedding = { isAvailable: jest.fn().mockReturnValue(false), embed: jest.fn() };
    const handler = new EmbedDocumentHandler(prisma as never, mockRlsTransaction(prisma) as never, embedding as never);
    await expect(handler.execute(dto)).rejects.toThrow('EmbeddingAdapter is not available');
  });
});

describe('EmbedDocumentHandler — chunking', () => {
  it('throws BadRequestException when EmbeddingAdapter not available', async () => {
    const prisma = { knowledgeDocument: { create: jest.fn() }, documentChunk: { createMany: jest.fn() } };
    const embedding = { isAvailable: jest.fn().mockReturnValue(false), embed: jest.fn() };
    const handler = new EmbedDocumentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never, embedding as never);
    await expect(handler.execute({
      title: 'Doc', content: 'text', sourceType: 'MANUAL' as never,
    })).rejects.toThrow('not available');
  });
});
