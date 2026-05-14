import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { ListDocumentsDto, UpdateDocumentDto } from './manage-knowledge-base.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type ListDocumentsQuery = ListDocumentsDto;
export type GetDocumentQuery = { documentId: string };
export type DeleteDocumentCommand = { documentId: string };
export type UpdateDocumentCommand = UpdateDocumentDto & { documentId: string };

@Injectable()
export class ManageKnowledgeBaseHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async listDocuments(dto: ListDocumentsQuery) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(dto.status ? { status: dto.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.knowledgeDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.knowledgeDocument.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getDocument(dto: GetDocumentQuery) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const doc = await this.prisma.knowledgeDocument.findFirst({
      where: { id: dto.documentId, organizationId },
      include: {
        chunks: {
          select: { id: true, chunkIndex: true, tokenCount: true },
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async deleteDocument(dto: DeleteDocumentCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const doc = await this.prisma.knowledgeDocument.findFirst({
      where: { id: dto.documentId, organizationId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.prisma.knowledgeDocument.delete({ where: { id: dto.documentId } });
  }

  async updateDocument(dto: UpdateDocumentCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const doc = await this.prisma.knowledgeDocument.findFirst({
      where: { id: dto.documentId, organizationId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.knowledgeDocument.update({
      where: { id: dto.documentId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.metadata !== undefined
          ? { metadata: dto.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
  }
}
