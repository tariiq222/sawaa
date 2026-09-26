import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
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
	internalClinic: {
		code: "DIRECT_CLINIC_SERVICE_CANNOT_BE_DELETED",
		message: "لا يمكن حذف خدمة حجز العيادة من هنا. أدر إعدادات العيادة من صفحة إدارة العيادة.",
	},
	packageReference: {
		code: "SERVICE_REFERENCED_BY_PACKAGE",
		message: "لا يمكن حذف الخدمة أو أرشفتها لأنها مرتبطة بباقة أو رصيد مشتَرى.",
	},
} as const;

function snapshotReferencesService(value: unknown, serviceId: string, durationOptionIds: Set<string>): boolean {
	if (Array.isArray(value)) return value.some((item) => snapshotReferencesService(item, serviceId, durationOptionIds));
	if (!value || typeof value !== "object") return false;

	const record = value as Record<string, unknown>;
	if (record.serviceId === serviceId) return true;
	if (typeof record.durationOptionId === "string" && durationOptionIds.has(record.durationOptionId)) return true;
	if (record.dimension === "SERVICE" && Array.isArray(record.targets) && record.targets.some((target) =>
		target && typeof target === "object" && (target as Record<string, unknown>).targetId === serviceId)) return true;
	if (record.dimension === "DURATION" && Array.isArray(record.targets) && record.targets.some((target) =>
		target && typeof target === "object" && typeof (target as Record<string, unknown>).targetId === "string" &&
		durationOptionIds.has((target as Record<string, string>).targetId))) return true;
	return Object.values(record).some((item) => snapshotReferencesService(item, serviceId, durationOptionIds));
}

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
			select: {
				id: true,
				isHidden: true,
				category: { select: { bookingMode: true } },
				durationOptions: { select: { id: true } },
			},
		});
		if (!service)
			throw new NotFoundException(ARCHIVE_SERVICE_MESSAGES.notFound);

		if (service.isHidden && service.category?.bookingMode === "DIRECT") {
			throw new ConflictException(ARCHIVE_SERVICE_MESSAGES.internalClinic);
		}

		const durationOptionIds = service.durationOptions.map(({ id }) => id);
		if (await this.hasPackageReferences(dto.serviceId, durationOptionIds)) {
			throw new ConflictException(ARCHIVE_SERVICE_MESSAGES.packageReference);
		}

		const bookingCount = await this.prisma.booking.count({
			where: { serviceId: dto.serviceId },
		});

		let result;
		if (bookingCount === 0) {
			result = await this.rlsTransaction.withTransaction(async (tx) => {
				await tx.employeeService.deleteMany({
					where: { serviceId: dto.serviceId },
				});
				// ServiceDurationOption.serviceId is a plain cross-BC string (no FK),
				// so both service-default and practitioner-owned duration rows for
				// this service orphan unless cleaned up here.
				await tx.serviceDurationOption.deleteMany({
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

	private async hasPackageReferences(serviceId: string, durationOptionIds: string[]): Promise<boolean> {
		const durationIds = new Set(durationOptionIds);
		const [packageGroup, packageItem, packageItemServiceTarget, packageItemDurationTarget,
			purchaseGroup, credit, creditServiceTarget, creditDurationTarget] = await Promise.all([
			this.prisma.sessionPackageGroup.findFirst({ where: { serviceId }, select: { id: true } }),
			this.prisma.sessionPackageItem.findFirst({
				where: { OR: [{ serviceId }, ...(durationOptionIds.length ? [{ durationOptionId: { in: durationOptionIds } }] : [])] },
				select: { id: true },
			}),
			this.prisma.sessionPackageItemConstraintTarget.findFirst({
				where: { targetId: serviceId, constraint: { dimension: "SERVICE" } }, select: { id: true },
			}),
			durationOptionIds.length ? this.prisma.sessionPackageItemConstraintTarget.findFirst({
				where: { targetId: { in: durationOptionIds }, constraint: { dimension: "DURATION" } }, select: { id: true },
			}) : null,
			this.prisma.packagePurchaseGroup.findFirst({ where: { serviceId }, select: { id: true } }),
			this.prisma.packageCredit.findFirst({
				where: { OR: [{ serviceId }, ...(durationOptionIds.length ? [{ durationOptionId: { in: durationOptionIds } }] : [])] },
				select: { id: true },
			}),
			this.prisma.packageCreditConstraintTarget.findFirst({
				where: { targetId: serviceId, constraint: { dimension: "SERVICE" } }, select: { id: true },
			}),
			durationOptionIds.length ? this.prisma.packageCreditConstraintTarget.findFirst({
				where: { targetId: { in: durationOptionIds }, constraint: { dimension: "DURATION" } }, select: { id: true },
			}) : null,
		]);

		if ([packageGroup, packageItem, packageItemServiceTarget, packageItemDurationTarget,
			purchaseGroup, credit, creditServiceTarget, creditDurationTarget].some(Boolean)) return true;

		// PENDING purchases have immutable snapshots but no issued credit rows yet.
		// Inspect both snapshot columns so payment activation can still use its captured entitlement.
		const pendingPurchases = await this.prisma.packagePurchase.findMany({
			where: { status: "PENDING" },
			select: { creditSnapshot: true, offerSnapshot: true },
		});
		return pendingPurchases.some((purchase) =>
			snapshotReferencesService(purchase.creditSnapshot, serviceId, durationIds) ||
			snapshotReferencesService(purchase.offerSnapshot, serviceId, durationIds),
		);
	}
}
