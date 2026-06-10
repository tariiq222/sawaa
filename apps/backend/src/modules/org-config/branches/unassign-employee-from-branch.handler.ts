import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";

export type UnassignEmployeeFromBranchCommand = {
	branchId: string;
	employeeId: string;
};

// رسائل الفصل بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const UNASSIGN_EMPLOYEE_MESSAGES = {
	branchNotFound: "الفرع غير موجود",
	assignmentNotFound: "الموظف غير مُسنَد إلى هذا الفرع",
} as const;

@Injectable()
export class UnassignEmployeeFromBranchHandler {
	constructor(private readonly prisma: PrismaService) {}

	async execute(dto: UnassignEmployeeFromBranchCommand) {
		const branch = await this.prisma.branch.findFirst({
			where: { id: dto.branchId },
			select: { id: true },
		});
		if (!branch)
			throw new NotFoundException(UNASSIGN_EMPLOYEE_MESSAGES.branchNotFound);

		const link = await this.prisma.employeeBranch.findFirst({
			where: {
				branchId: dto.branchId,
				employeeId: dto.employeeId,
			},
			select: { id: true },
		});
		if (!link)
			throw new NotFoundException(
				UNASSIGN_EMPLOYEE_MESSAGES.assignmentNotFound,
			);

		await this.prisma.employeeBranch.delete({ where: { id: link.id } });
		return { id: link.id };
	}
}
