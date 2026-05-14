import { ManageKnowledgeBaseHandler } from './manage-knowledge-base.handler';
import { NotFoundException } from '@nestjs/common';

const mockDoc = { id: 'doc-1', title: 'FAQ', status: 'EMBEDDED', createdAt: new Date() };

const mockPrisma = () => ({
  knowledgeDocument: {
    findMany: jest.fn().mockResolvedValue([mockDoc]),
    findFirst: jest.fn().mockResolvedValue(mockDoc),
    update: jest.fn().mockResolvedValue({ ...mockDoc, title: 'Updated FAQ' }),
    delete: jest.fn().mockResolvedValue(mockDoc),
    count: jest.fn().mockResolvedValue(1),
  },
});

const mockTenant = () => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue('org-1'),
});

describe('ManageKnowledgeBaseHandler', () => {
  it('listDocuments returns paginated documents', async () => {
    const prisma = mockPrisma();
    const tenant = mockTenant();
    const handler = new ManageKnowledgeBaseHandler(prisma as never, tenant as never);
    const result = await handler.listDocuments({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('getDocument returns document by id', async () => {
    const prisma = mockPrisma();
    const tenant = mockTenant();
    const handler = new ManageKnowledgeBaseHandler(prisma as never, tenant as never);
    const result = await handler.getDocument({ documentId: 'doc-1' });
    expect(result.id).toBe('doc-1');
  });

  it('getDocument throws NotFoundException when document does not exist', async () => {
    const prisma = mockPrisma();
    prisma.knowledgeDocument.findFirst = jest.fn().mockResolvedValue(null);
    const tenant = mockTenant();
    const handler = new ManageKnowledgeBaseHandler(prisma as never, tenant as never);
    await expect(handler.getDocument({ documentId: 'doc-x' })).rejects.toThrow(NotFoundException);
  });

  it('deleteDocument removes the document', async () => {
    const prisma = mockPrisma();
    const tenant = mockTenant();
    const handler = new ManageKnowledgeBaseHandler(prisma as never, tenant as never);
    await handler.deleteDocument({ documentId: 'doc-1' });
    expect(prisma.knowledgeDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
  });

  it('updateDocument updates title and metadata', async () => {
    const prisma = mockPrisma();
    const tenant = mockTenant();
    const handler = new ManageKnowledgeBaseHandler(prisma as never, tenant as never);
    const result = await handler.updateDocument({ documentId: 'doc-1', title: 'Updated FAQ' });
    expect(result.title).toBe('Updated FAQ');
  });
});
