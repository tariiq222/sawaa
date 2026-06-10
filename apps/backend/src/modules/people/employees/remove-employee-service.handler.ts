import { Injectable, NotFoundException } from "@nestjs/common";
import {
	PrismaService,
	RlsTransactionService,
} from "../../../infrastructure/database";

export interface RemoveEmployeeServiceCommand {
	employeeId: string;
	serviceId: string;
}

// رسائل إزالة الخدمة بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const REMOVE_EMPLOYEE_SERVICE_MESSAGES = {
	notFound: "تعيين الخدمة للموظف غير موجود",
} as const;

@Injectable()
export class RemoveEmployeeServiceHandler {
	constructor(
		private readonly prisma: PrismaService,
		private readonly rlsTransaction: RlsTransactionService,
	) {}

	async execute(cmd: RemoveEmployeeServiceCommand): Promise<void> {
		const record = await this.prisma.employeeService.findUnique({
			where: {
				employeeId_serviceId: {
					employeeId: cmd.employeeId,
					serviceId: cmd.serviceId,
				},
			},
		});
		if (!record) {
			throw new NotFoundException(REMOVE_EMPLOYEE_SERVICE_MESSAGES.notFound);
		}
		// EmployeeServiceOption.employeeServiceId is a plain cross-BC string (no FK),
		// so price-override rows must be cleaned up here or they orphan.
		await this.rlsTransaction.withTransaction((tx) =>
			Promise.all([
				tx.employeeServiceOption.deleteMany({
					where: { employeeServiceId: record.id },
				}),
				tx.employeeService.delete({
					where: {
						employeeId_serviceId: {
							employeeId: cmd.employeeId,
							serviceId: cmd.serviceId,
						},
					},
				}),
			]),
		);
	}
}
