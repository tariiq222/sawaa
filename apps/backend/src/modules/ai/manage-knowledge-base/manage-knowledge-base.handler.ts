import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../infrastructure/database";
import {
	ListDocumentsDto,
	UpdateDocumentDto,
} from "./manage-knowledge-base.dto";

export type ListDocumentsQuery = ListDocumentsDto;
export type GetDocumentQuery = { documentId: string };
export type DeleteDocumentCommand = { documentId: string };
export type UpdateDocumentCommand = UpdateDocumentDto & { documentId: string };

@Injectable()
export class ManageKnowledgeBaseHandler {
	constructor(private readonly prisma: PrismaService) {}

	async listDocuments(dto: ListDocumentsQuery) {
		const page = dto.page ?? 1;
		const limit = Math.min(dto.limit ?? 20, 100);
		const skip = (page - 1) * limit;

		const where = {
			...(dto.status ? { status: dto.status } : {}),
		};

		const [data, total] = await Promise.all([
			this.prisma.knowledgeDocument.findMany({
				where,
				skip,
				take: limit,
				orderBy: { createdAt: "desc" },
			}),
			this.prisma.knowledgeDocument.count({ where }),
		]);

		return {
			data,
			meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
		};
	}

	async getDocument(dto: GetDocumentQuery) {
		const doc = await this.prisma.knowledgeDocument.findFirst({
			where: { id: dto.documentId },
			include: {
				chunks: {
					select: { id: true, chunkIndex: true, tokenCount: true },
					orderBy: { chunkIndex: "asc" },
				},
			},
		});
		if (!doc) throw new NotFoundException("الوثيقة غير موجودة");
		return doc;
	}

	async deleteDocument(dto: DeleteDocumentCommand) {
		const doc = await this.prisma.knowledgeDocument.findFirst({
			where: { id: dto.documentId },
		});
		if (!doc) throw new NotFoundException("الوثيقة غير موجودة");
		await this.prisma.knowledgeDocument.delete({
			where: { id: dto.documentId },
		});
	}

	async updateDocument(dto: UpdateDocumentCommand) {
		const doc = await this.prisma.knowledgeDocument.findFirst({
			where: { id: dto.documentId },
		});
		if (!doc) throw new NotFoundException("الوثيقة غير موجودة");
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
