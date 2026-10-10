import { CacheService } from '../../../infrastructure/cache';
import { SERVICES_CACHE_PREFIX } from '../../org-experience/services/services.cache';
import {
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RlsTransactionService } from "../../../infrastructure/database";
import { lockPersonReferences } from "../../../common/database/person-reference-lock.helper";
import { ACTIVE_BOOKING_STATUSES } from "../../bookings/active-booking-statuses";

export interface DeleteEmployeeCommand {
	employeeId: string;
}

// رسائل الحذف بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const DELETE_EMPLOYEE_MESSAGES = {
	notFound: "الموظف غير موجود",
	hasActiveBookings: (n: number) =>
		`لا يمكن حذف الموظف لوجود ${n} حجز${n === 1 ? "" : "اً"} نشط${n === 1 ? "" : "ة"} مسندة إليه. يرجى إلغاؤها أو إتمامها أولاً.`,
	supervisingPrograms: (n: number) =>
		`لا يمكن حذف الموظف لأنه يشرف على ${n} برنامج جماعي${n === 1 ? "" : "ات"} غير منتهٍ. يرجى إزالة إشرافه أو إنهاء البرنامج أولاً.`,
	hasUnpaidInvoices: (n: number) =>
		`لا يمكن حذف الموظف لوجود ${n} فاتورة${n === 1 ? " غير" : ""} مدفوعة. يرجى تسويتها أولاً.`,
	hasRatings: (n: number) =>
		`لا يمكن حذف الموظف لوجود ${n} تقييم${n === 1 ? "" : "ات"}. يجب الحفاظ على التقييمات لأغراض التدقيق.`,
} as const;

@Injectable()
export class DeleteEmployeeHandler {
	constructor(private readonly rlsTransaction: RlsTransactionService, private readonly cache: CacheService) {}

	async execute(cmd: DeleteEmployeeCommand): Promise<void> {
		await this.rlsTransaction.withTransaction(
			async (tx) => {
				await lockPersonReferences(
					tx,
					[{ kind: "Employee", id: cmd.employeeId }],
					"delete",
				);

				const employee = await tx.employee.findFirst({
					where: { id: cmd.employeeId },
				});
				if (!employee)
					throw new NotFoundException(DELETE_EMPLOYEE_MESSAGES.notFound);

				const activeBookings = await tx.booking.count({
					where: {
						employeeId: cmd.employeeId,
						status: { in: [...ACTIVE_BOOKING_STATUSES] },
					},
				});
				if (activeBookings > 0) {
					throw new ConflictException(
						DELETE_EMPLOYEE_MESSAGES.hasActiveBookings(activeBookings),
					);
				}

				const supervisingPrograms = await tx.programSupervisor.count({
					where: {
						employeeId: cmd.employeeId,
						program: {
							status: { notIn: ["COMPLETED", "CANCELLED"] },
						},
					},
				});
				if (supervisingPrograms > 0) {
					throw new ConflictException(
						DELETE_EMPLOYEE_MESSAGES.supervisingPrograms(supervisingPrograms),
					);
				}

				const unpaidInvoices = await tx.invoice.count({
					where: {
						employeeId: cmd.employeeId,
						status: { in: ["DRAFT", "ISSUED", "PARTIALLY_PAID"] },
					},
				});
				if (unpaidInvoices > 0) {
					throw new ConflictException(
						DELETE_EMPLOYEE_MESSAGES.hasUnpaidInvoices(unpaidInvoices),
					);
				}

				const ratings = await tx.rating.count({
					where: { employeeId: cmd.employeeId },
				});
				if (ratings > 0) {
					throw new ConflictException(
						DELETE_EMPLOYEE_MESSAGES.hasRatings(ratings),
					);
				}

				// Orphan cleanup (people → org-experience): EmployeeService cascades
				// when the employee is deleted, but ServiceDurationOption and
				// EmployeeServiceOption reference EmployeeService.id via a plain
				// cross-BC string (no FK). Deleting them here, keyed by the
				// employee's EmployeeService ids (esIds), prevents practitioner-owned
				// duration rows and price-override rows from orphaning. Same class as
				// the prior production orphan bug in remove-employee-service.handler.
				const employeeServices = await tx.employeeService.findMany({
					where: { employeeId: cmd.employeeId },
					select: { id: true },
				});
				const esIds = employeeServices.map((es) => es.id);
				if (esIds.length > 0) {
					await tx.employeeServiceOption.deleteMany({
						where: { employeeServiceId: { in: esIds } },
					});
					await tx.serviceDurationOption.deleteMany({
						where: { employeeServiceId: { in: esIds } },
					});
				}

				await tx.employee.delete({ where: { id: cmd.employeeId } });
			},
			{
				// Every relationship guard needs a new snapshot after a competing
				// writer releases its shared person lock.
				isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
			},
		);
		await this.cache.invalidatePrefix(SERVICES_CACHE_PREFIX);
	}
}
