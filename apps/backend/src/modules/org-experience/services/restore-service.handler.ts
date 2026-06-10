import {
	Injectable,
	NotFoundException,
	BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";
import { CacheService } from "../../../infrastructure/cache";
import { SERVICES_CACHE_PREFIX } from "./services.cache";

export type RestoreServiceCommand = { serviceId: string };

// رسائل الاستعادة بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const RESTORE_SERVICE_MESSAGES = {
	notFound: "الخدمة غير موجودة",
	notArchived: "الخدمة ليست مؤرشفة",
} as const;

@Injectable()
export class RestoreServiceHandler {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cache: CacheService,
	) {}

	async execute(dto: RestoreServiceCommand) {
		const service = await this.prisma.service.findUnique({
			where: { id: dto.serviceId },
		});
		if (!service)
			throw new NotFoundException(RESTORE_SERVICE_MESSAGES.notFound);
		if (service.archivedAt === null) {
			throw new BadRequestException(RESTORE_SERVICE_MESSAGES.notArchived);
		}

		const restored = await this.prisma.service.update({
			where: { id: dto.serviceId },
			data: { archivedAt: null },
			include: {
				category: true,
				durationOptions: { orderBy: { sortOrder: "asc" } },
			},
		});

		await this.cache.invalidatePrefix(SERVICES_CACHE_PREFIX);
		return restored;
	}
}
