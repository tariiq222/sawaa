import {
	Injectable,
	NotFoundException,
	ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";
import { CacheService } from "../../../infrastructure/cache";
import { BRANCHES_CACHE_PREFIX } from "./branches.cache";

export type DeleteBranchCommand = { branchId: string };

// رسائل الحذف بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const DELETE_BRANCH_MESSAGES = {
	notFound: "الفرع غير موجود",
	hasAssignedEmployees: (n: number) =>
		`لا يمكن حذف الفرع لوجود ${n} موظف${n === 1 ? "" : "ين"} مرتبطين به. يرجى فصلهم أولاً.`,
	hasBookingsAndPrograms: (b: number, p: number) =>
		`لا يمكن حذف الفرع لوجود ${b} حجز${b === 1 ? "" : "اً"} و ${p} برنامج جماعي${p === 1 ? "" : "ات"} مرتبطة به.`,
} as const;

@Injectable()
export class DeleteBranchHandler {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cache: CacheService,
	) {}

	async execute(dto: DeleteBranchCommand) {
		const branch = await this.prisma.branch.findFirst({
			where: { id: dto.branchId },
		});
		if (!branch) throw new NotFoundException(DELETE_BRANCH_MESSAGES.notFound);

		const linkedEmployees = await this.prisma.employeeBranch.count({
			where: { branchId: dto.branchId },
		});
		if (linkedEmployees > 0) {
			throw new ConflictException(
				DELETE_BRANCH_MESSAGES.hasAssignedEmployees(linkedEmployees),
			);
		}

		// Booking/Program carry branchId as a plain cross-BC string with no FK,
		// so the DB will not block deletion — guard manually to avoid leaving rows
		// pointing at a non-existent branch.
		const [linkedBookings, linkedPrograms] =
			await Promise.all([
				this.prisma.booking.count({ where: { branchId: dto.branchId } }),
				this.prisma.program.count({ where: { branchId: dto.branchId } }),
			]);
		if (linkedBookings > 0 || linkedPrograms > 0) {
			throw new ConflictException(
				DELETE_BRANCH_MESSAGES.hasBookingsAndPrograms(
					linkedBookings,
					linkedPrograms,
				),
			);
		}

		await this.prisma.branch.delete({ where: { id: dto.branchId } });

		await this.cache.invalidatePrefix(BRANCHES_CACHE_PREFIX);

		return { id: dto.branchId };
	}
}
