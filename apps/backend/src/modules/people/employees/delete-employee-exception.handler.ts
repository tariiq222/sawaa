import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";

export interface DeleteEmployeeExceptionCommand {
	employeeId: string;
	exceptionId: string;
}

// رسائل الحذف بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const DELETE_EMPLOYEE_EXCEPTION_MESSAGES = {
	notFound: "الاستثناء (إجازة/تعديل توفر) غير موجود لهذا الموظف",
} as const;

@Injectable()
export class DeleteEmployeeExceptionHandler {
	constructor(private readonly prisma: PrismaService) {}

	async execute(cmd: DeleteEmployeeExceptionCommand): Promise<void> {
		const record = await this.prisma.employeeAvailabilityException.findFirst({
			where: { id: cmd.exceptionId, employeeId: cmd.employeeId },
		});
		if (!record)
			throw new NotFoundException(DELETE_EMPLOYEE_EXCEPTION_MESSAGES.notFound);
		await this.prisma.employeeAvailabilityException.delete({
			where: { id: cmd.exceptionId },
		});
	}
}
