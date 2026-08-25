import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { ActivityAction, DocumentStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../infrastructure/database';
import { RlsTransactionService } from '../../../common/database/rls-transaction';
import { CreateDocumentDto, ListDocumentsDto, UpdateDocumentDto } from './manage-knowledge-base.dto';

const REINDEX_EVENT = 'ai.knowledge.reindex_requested.v1';
export type ListDocumentsQuery = ListDocumentsDto;
export type GetDocumentQuery = { documentId: string };
export type DeleteDocumentCommand = { documentId: string; actor?: ActivityActor };
export type CreateDocumentCommand = CreateDocumentDto & { actor?: ActivityActor };
export type UpdateDocumentCommand = UpdateDocumentDto & { documentId: string; actor?: ActivityActor };
export type PublishDocumentCommand = { documentId: string; actor?: ActivityActor };
export type UnpublishDocumentCommand = { documentId: string; actor?: ActivityActor };
export type ReindexDocumentCommand = { documentId: string; actor?: ActivityActor };
type ActivityActor = { id?: string; email?: string };
type TransactionLike = Prisma.TransactionClient;

const LIST_SELECT = {
  id: true, title: true, sourceType: true, sourceRef: true, isPublished: true, publishedAt: true,
  lastIndexedAt: true, lastIndexErrorCode: true, contentHash: true, status: true, metadata: true,
  createdAt: true, updatedAt: true,
} as const;
const DETAIL_SELECT = { ...LIST_SELECT, content: true, chunks: { select: { id: true, chunkIndex: true, tokenCount: true }, orderBy: { chunkIndex: 'asc' as const } } } as const;
function contentHash(content: string): string { return createHash('sha256').update(content, 'utf8').digest('hex'); }
function hasContent(content: string | null | undefined): content is string { return typeof content === 'string' && content.trim().length > 0; }
function safeMetadata(actor?: ActivityActor, extra?: Record<string, unknown>) { return { ...(actor?.id ? { actorId: actor.id } : {}), ...(extra ?? {}) } as Prisma.InputJsonValue; }

@Injectable()
export class ManageKnowledgeBaseHandler {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly rls?: RlsTransactionService) {}
  private async transaction<T>(fn: (tx: TransactionLike) => Promise<T>): Promise<T> {
    if (this.rls) return this.rls.withTransaction((tx) => fn(tx as TransactionLike));
    return fn(this.prisma as unknown as TransactionLike);
  }
  /** Serialize lifecycle commands on the document row before reading it. */
  private async lockDocument(tx: TransactionLike, documentId: string): Promise<void> {
    const queryRaw = (tx as unknown as { $queryRaw?: Function }).$queryRaw;
    if (!queryRaw) return;
    await queryRaw(Prisma.sql`SELECT "id" FROM "KnowledgeDocument" WHERE "id" = ${documentId} FOR UPDATE`);
  }
  private async recordActivity(tx: TransactionLike, action: ActivityAction, description: string, documentId: string | undefined, actor?: ActivityActor, metadata?: Record<string, unknown>) {
    const activityLog = (tx as unknown as { activityLog?: { create: Function } }).activityLog;
    if (!activityLog?.create) return;
    await activityLog.create({ data: { userId: actor?.id, userEmail: actor?.email, action, entity: 'KnowledgeDocument', entityId: documentId, description, metadata: safeMetadata(actor, metadata) } });
  }
  async listDocuments(dto: ListDocumentsQuery) {
    const page = dto.page ?? 1; const limit = Math.min(dto.limit ?? 20, 100); const skip = (page - 1) * limit;
    const where = { ...(dto.status ? { status: dto.status } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.knowledgeDocument.findMany({ where, skip, take: limit, select: LIST_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.knowledgeDocument.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
  async getDocument(dto: GetDocumentQuery) {
    const doc = await this.prisma.knowledgeDocument.findFirst({ where: { id: dto.documentId }, select: DETAIL_SELECT });
    if (!doc) throw new NotFoundException('الوثيقة غير موجودة'); return doc;
  }
  async createDocument(dto: CreateDocumentCommand) {
    const body = hasContent(dto.content) ? dto.content : null; const hash = body ? contentHash(body) : null;
    return this.transaction(async (tx) => {
      const doc = await tx.knowledgeDocument.create({ data: { title: dto.title, sourceType: dto.sourceType, sourceRef: dto.sourceRef, content: body, contentHash: hash, metadata: dto.metadata as Prisma.InputJsonValue | undefined, isPublished: false, publishedAt: null, status: DocumentStatus.PENDING }, select: LIST_SELECT });
      await this.recordActivity(tx, ActivityAction.CREATE, 'Knowledge document created', doc.id, dto.actor, { sourceType: dto.sourceType }); return doc;
    });
  }
  async deleteDocument(dto: DeleteDocumentCommand) {
    await this.transaction(async (tx) => {
      await this.lockDocument(tx, dto.documentId);
      const existing = await tx.knowledgeDocument.findFirst({ where: { id: dto.documentId }, select: { id: true } });
      if (!existing) throw new NotFoundException('الوثيقة غير موجودة');
      await tx.knowledgeDocument.delete({ where: { id: dto.documentId } }); await this.recordActivity(tx, ActivityAction.DELETE, 'Knowledge document deleted', dto.documentId, dto.actor);
    });
  }
  async updateDocument(dto: UpdateDocumentCommand) {
    return this.transaction(async (tx) => {
      await this.lockDocument(tx, dto.documentId);
      const existing = await tx.knowledgeDocument.findFirst({ where: { id: dto.documentId }, select: { id: true, content: true, sourceType: true, sourceRef: true } });
      if (!existing) throw new NotFoundException('الوثيقة غير موجودة');
      const contentChanged = dto.content !== undefined && dto.content !== existing.content;
      const sourceChanged = (dto.sourceType !== undefined && dto.sourceType !== existing.sourceType) || (dto.sourceRef !== undefined && dto.sourceRef !== existing.sourceRef);
      const materialChanged = contentChanged || sourceChanged; const body = dto.content !== undefined ? (hasContent(dto.content) ? dto.content : null) : undefined;
      const data: Prisma.KnowledgeDocumentUpdateInput = {
        ...(dto.title !== undefined ? { title: dto.title } : {}), ...(dto.metadata !== undefined ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}),
        ...(dto.sourceType !== undefined ? { sourceType: dto.sourceType } : {}), ...(dto.sourceRef !== undefined ? { sourceRef: dto.sourceRef } : {}),
        ...(body !== undefined ? { content: body, contentHash: body ? contentHash(body) : null } : {}), ...(materialChanged ? { isPublished: false, publishedAt: null, status: DocumentStatus.PENDING, lastIndexedAt: null, lastIndexErrorCode: null } : {}),
      };
      const doc = await tx.knowledgeDocument.update({ where: { id: dto.documentId }, data, select: LIST_SELECT }); await this.recordActivity(tx, ActivityAction.UPDATE, 'Knowledge document updated', doc.id, dto.actor, materialChanged ? { contentInvalidated: true } : undefined); return doc;
    });
  }
  async publishDocument(dto: PublishDocumentCommand) {
    return this.transaction(async (tx) => {
      await this.lockDocument(tx, dto.documentId);
      const existing = await tx.knowledgeDocument.findFirst({ where: { id: dto.documentId }, select: { id: true, content: true } });
      if (!existing) throw new NotFoundException('الوثيقة غير موجودة'); if (!hasContent(existing.content)) throw new BadRequestException('لا يمكن نشر وثيقة بلا محتوى');
      const doc = await tx.knowledgeDocument.update({ where: { id: dto.documentId }, data: { isPublished: true, publishedAt: new Date(), lastIndexErrorCode: null }, select: LIST_SELECT });
      await this.recordActivity(tx, ActivityAction.UPDATE, 'Knowledge document published', doc.id, dto.actor, { isPublished: true }); return doc;
    });
  }
  async unpublishDocument(dto: UnpublishDocumentCommand) {
    return this.transaction(async (tx) => {
      await this.lockDocument(tx, dto.documentId);
      const existing = await tx.knowledgeDocument.findFirst({ where: { id: dto.documentId }, select: { id: true } }); if (!existing) throw new NotFoundException('الوثيقة غير موجودة');
      const doc = await tx.knowledgeDocument.update({ where: { id: dto.documentId }, data: { isPublished: false, publishedAt: null }, select: LIST_SELECT });
      await this.recordActivity(tx, ActivityAction.UPDATE, 'Knowledge document unpublished', doc.id, dto.actor, { isPublished: false }); return doc;
    });
  }
  async reindexDocument(dto: ReindexDocumentCommand) {
    return this.transaction(async (tx) => {
      await this.lockDocument(tx, dto.documentId);
      const existing = await tx.knowledgeDocument.findFirst({ where: { id: dto.documentId }, select: { id: true, content: true } }); if (!existing) throw new NotFoundException('الوثيقة غير موجودة'); if (!hasContent(existing.content)) throw new BadRequestException('لا يمكن إعادة فهرسة وثيقة بلا محتوى');
      const hash = contentHash(existing.content); await tx.knowledgeDocument.update({ where: { id: dto.documentId }, data: { contentHash: hash, isPublished: false, publishedAt: null, status: DocumentStatus.PENDING, lastIndexedAt: null, lastIndexErrorCode: null } });
      const outbox = (tx as unknown as { outboxEvent?: { findFirst?: Function; create: Function } }).outboxEvent; let event = outbox ? await outbox.findFirst?.({ where: { aggregateId: dto.documentId, eventType: REINDEX_EVENT, payload: { path: ['contentHash'], equals: hash } } }) : null;
      if (!event && outbox?.create) event = await outbox.create({ data: { aggregateId: dto.documentId, eventType: REINDEX_EVENT, payload: { documentId: dto.documentId, contentHash: hash, version: 'PENDING_V2' }, status: 'PENDING_V2', deliveryLane: 'PENDING_V2' } });
      await this.recordActivity(tx, ActivityAction.SYSTEM, 'Knowledge document reindex requested', dto.documentId, dto.actor, { contentHash: hash, eventType: REINDEX_EVENT }); return { documentId: dto.documentId, contentHash: hash, eventId: event?.id ?? null, status: 'PENDING' as const };
    });
  }
}
