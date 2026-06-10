import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";

export type ArchiveBundleCommand = { bundleId: string };

// رسائل الأرشفة بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const ARCHIVE_BUNDLE_MESSAGES = {
	notFound: "الباقة غير موجودة أو مؤرشفة بالفعل",
} as const;

@Injectable()
export class ArchiveBundleHandler {
	constructor(private readonly prisma: PrismaService) {}

	async execute(dto: ArchiveBundleCommand) {
		const bundle = await this.prisma.serviceBundle.findFirst({
			where: { id: dto.bundleId, archivedAt: null },
		});
		if (!bundle) throw new NotFoundException(ARCHIVE_BUNDLE_MESSAGES.notFound);

		return this.prisma.serviceBundle.update({
			where: { id: dto.bundleId },
			data: { archivedAt: new Date(), isActive: false },
		});
	}
}
