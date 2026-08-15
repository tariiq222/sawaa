import { ManageKnowledgeBaseHandler } from './manage-knowledge-base.handler';
import { NotFoundException } from '@nestjs/common';

const mockDoc = { id: 'doc-1', title: 'FAQ', status: 'EMBEDDED', content: 'مرحباً', sourceType: 'manual', sourceRef: null, createdAt: new Date() };

const mockPrisma = (): any => ({
  knowledgeDocument: {
    findMany: jest.fn().mockResolvedValue([mockDoc]),
    findFirst: jest.fn().mockResolvedValue(mockDoc),
    update: jest.fn().mockResolvedValue({ ...mockDoc, title: 'Updated FAQ' }),
    delete: jest.fn().mockResolvedValue(mockDoc),
    count: jest.fn().mockResolvedValue(1),
  },
  activityLog: { create: jest.fn().mockResolvedValue({}) },
  outboxEvent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
  $queryRaw: jest.fn().mockResolvedValue([]),
  $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(mockPrisma())),
});

describe('ManageKnowledgeBaseHandler', () => {
  it('listDocuments returns paginated documents', async () => {
    const prisma = mockPrisma();
    const handler = new ManageKnowledgeBaseHandler(prisma as never);
    const result = await handler.listDocuments({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('getDocument returns document by id', async () => {
    const prisma = mockPrisma();
    const handler = new ManageKnowledgeBaseHandler(prisma as never);
    const result = await handler.getDocument({ documentId: 'doc-1' });
    expect(result.id).toBe('doc-1');
  });

  it('getDocument throws NotFoundException when document does not exist', async () => {
    const prisma = mockPrisma();
    prisma.knowledgeDocument.findFirst = jest.fn().mockResolvedValue(null);
    // removed
    const handler = new ManageKnowledgeBaseHandler(prisma as never);
    await expect(handler.getDocument({ documentId: 'doc-x' })).rejects.toThrow(NotFoundException);
  });

  it('deleteDocument removes the document', async () => {
    const prisma = mockPrisma();
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(prisma));
    // removed
    const handler = new ManageKnowledgeBaseHandler(prisma as never);
    await handler.deleteDocument({ documentId: 'doc-1' });
    expect(prisma.knowledgeDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
  });

  it('updateDocument updates title and metadata', async () => {
    const prisma = mockPrisma();
    // removed
    const handler = new ManageKnowledgeBaseHandler(prisma as never);
    const result = await handler.updateDocument({ documentId: 'doc-1', title: 'Updated FAQ' });
    expect(result.title).toBe('Updated FAQ');
  });

  it('creates a manual document as an unpublished pending safe projection', async () => {
    const prisma = mockPrisma();
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(prisma));
    prisma.knowledgeDocument.create = jest.fn().mockResolvedValue({ ...mockDoc, isPublished: false, status: 'PENDING' });
    const result = await new ManageKnowledgeBaseHandler(prisma as never).createDocument({
      title: 'الخدمات', sourceType: 'manual', content: 'جلسات أسرية حضورية وعن بعد', actor: { id: 'staff-1' },
    });
    expect(result.isPublished).toBe(false);
    expect(prisma.knowledgeDocument.create.mock.calls[0][0].data).toMatchObject({ status: 'PENDING', isPublished: false });
    expect(prisma.activityLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entity: 'KnowledgeDocument' }) }));
  });

  it('updates content and immediately unpublishes stale indexed content', async () => {
    const prisma = mockPrisma();
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(prisma));
    prisma.knowledgeDocument.update = jest.fn().mockResolvedValue({ ...mockDoc, isPublished: false, status: 'PENDING' });
    await new ManageKnowledgeBaseHandler(prisma as never).updateDocument({ documentId: 'doc-1', content: 'محتوى محدث' });
    expect(prisma.knowledgeDocument.update.mock.calls[0][0].data).toMatchObject({ isPublished: false, status: 'PENDING', publishedAt: null, lastIndexedAt: null });
  });

  it('publishes only when non-empty content exists', async () => {
    const prisma = mockPrisma();
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(prisma));
    prisma.knowledgeDocument.findFirst = jest.fn().mockResolvedValue({ id: 'doc-1', content: null });
    await expect(new ManageKnowledgeBaseHandler(prisma as never).publishDocument({ documentId: 'doc-1' })).rejects.toThrow('بلا محتوى');
    expect(prisma.knowledgeDocument.update).not.toHaveBeenCalled();
  });

  it('unpublishes and clears the publication timestamp', async () => {
    const prisma = mockPrisma();
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(prisma));
    prisma.knowledgeDocument.update = jest.fn().mockResolvedValue({ ...mockDoc, isPublished: false });
    await new ManageKnowledgeBaseHandler(prisma as never).unpublishDocument({ documentId: 'doc-1' });
    expect(prisma.knowledgeDocument.update.mock.calls[0][0].data).toEqual({ isPublished: false, publishedAt: null });
  });

  it('writes one stable PENDING_V2 reindex event and is idempotent', async () => {
    const prisma = mockPrisma();
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(prisma));
    const outbox = prisma.outboxEvent;
    await new ManageKnowledgeBaseHandler(prisma as never).reindexDocument({ documentId: 'doc-1' });
    outbox.findFirst.mockResolvedValue({ id: 'event-1' });
    await new ManageKnowledgeBaseHandler(prisma as never).reindexDocument({ documentId: 'doc-1' });
    expect(outbox.create).toHaveBeenCalledTimes(1);
    expect(outbox.create.mock.calls[0][0].data.payload).toMatchObject({ documentId: 'doc-1', version: 'PENDING_V2' });
  });

  it('does not expose content in list projection and uses a stable tie-breaker', async () => {
    const prisma = mockPrisma();
    await new ManageKnowledgeBaseHandler(prisma as never).listDocuments({ page: 2, limit: 10 });
    expect(prisma.knowledgeDocument.findMany.mock.calls[0][0]).toMatchObject({ skip: 10, take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    expect(prisma.knowledgeDocument.findMany.mock.calls[0][0].select.content).toBeUndefined();
  });

  it('takes a row lock before every lifecycle read', async () => {
    const prisma = mockPrisma();
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(prisma));
    const handler = new ManageKnowledgeBaseHandler(prisma as never);
    await handler.updateDocument({ documentId: 'doc-1', title: 'New title' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.knowledgeDocument.findFirst.mock.invocationCallOrder.at(-1));
  });
});
