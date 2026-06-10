import { Injectable, NotFoundException } from "@nestjs/common";
import {
	PrismaService,
	RlsTransactionService,
} from "../../../infrastructure/database";
import { CacheService } from "../../../infrastructure/cache";
import { SERVICES_CACHE_PREFIX } from "./services.cache";

export type ArchiveServiceCommand = { serviceId: string };

// رسائل الأرشفة بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const ARCHIVE_SERVICE_MESSAGES = {
	notFound: "الخدمة غير موجودة أو مؤرشفة بالفعل",
} as const;

@Injectable()
export class ArchiveServiceHandler {
	constructor(
		private readonly prisma: PrismaService,
		private readonly rlsTransaction: RlsTransactionService,
		private readonly cache: CacheService,
	) {}

	async execute(dto: ArchiveServiceCommand) {
		const service = await this.prisma.service.findFirst({
			where: { id: dto.serviceId, archivedAt: null },
		});
		if (!service)
			throw new NotFoundException(ARCHIVE_SERVICE_MESSAGES.notFound);

		const bookingCount = await this.prisma.booking.count({
			where: { serviceId: dto.serviceId },
		});

		let result;
		if (bookingCount === 0) {
			result = await this.rlsTransaction.withTransaction(async (tx) => {
				await tx.employeeService.deleteMany({
					where: { serviceId: dto.serviceId },
				});
				await tx.serviceBundleItem.deleteMany({
					where: { serviceId: dto.serviceId },
				});
				return tx.service.delete({
					where: { id: dto.serviceId },
				});
			});
		} else {
			result = await this.prisma.service.update({
				where: { id: dto.serviceId },
				data: { archivedAt: new Date(), isActive: false },
			});
		}

		await this.cache.invalidatePrefix(SERVICES_CACHE_PREFIX);

		return result;
	}
}
