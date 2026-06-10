import {
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
	PrismaService,
	RlsTransactionService,
} from "../../../infrastructure/database";

export interface DeleteEmployeeCommand {
	employeeId: string;
}

// رسائل الحذف بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const DELETE_EMPLOYEE_MESSAGES = {
	notFound: "الموظف غير موجود",
	hasActiveBookings: (n: number) =>
		`لا يمكن حذف الموظف لوجود ${n} حجز${n === 1 ? "" : "اً"} نشط${n === 1 ? "" : "ة"} مسندة إليه. يرجى إلغاؤها أو إتمامها أولاً.`,
	hostingGroupSessions: (n: number) =>
		`لا يمكن حذف الموظف لأنه يستضيف ${n} جلسة جماعية${n === 1 ? "" : "ات"} قادمة. يرجى إلغاؤها أولاً.`,
	hasUnpaidInvoices: (n: number) =>
		`لا يمكن حذف الموظف لوجود ${n} فاتورة${n === 1 ? "" : " غير"} مدفوعة. يرجى تسويتها أولاً.`,
	hasWaitlistEntries: (n: number) =>
		`لا يمكن حذف الموظف لوجود ${n} طلب${n === 1 ? "" : "ات"} في قائمة الانتظار. يرجى إزالتها أولاً.`,
	hasRatings: (n: number) =>
		`لا يمكن حذف الموظف لوجود ${n} تقييم${n === 1 ? "" : "ات"}. يجب الحفاظ على التقييمات لأغراض التدقيق.`,
} as const;

@Injectable()
export class DeleteEmployeeHandler {
	constructor(
		private readonly prisma: PrismaService,
		private readonly rlsTransaction: RlsTransactionService,
	) {}

	async execute(cmd: DeleteEmployeeCommand): Promise<void> {
		await this.rlsTransaction.withTransaction(
			async (tx) => {
				await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${cmd.employeeId} FOR UPDATE`;

				const employee = await tx.employee.findFirst({
					where: { id: cmd.employeeId },
				});
				if (!employee)
					throw new NotFoundException(DELETE_EMPLOYEE_MESSAGES.notFound);

				// ─── Cross-BC integrity guards ───────────────────────────────────────────
				// Booking (people → bookings): block if any active appointment exists
				const activeBookings = await tx.booking.count({
					where: {
						employeeId: cmd.employeeId,
						status: {
							in: [
								"PENDING",
								"PENDING_GROUP_FILL",
								"AWAITING_PAYMENT",
								"CONFIRMED",
								"CANCEL_REQUESTED",
							],
						},
					},
				});
				if (activeBookings > 0) {
					throw new ConflictException(
						DELETE_EMPLOYEE_MESSAGES.hasActiveBookings(activeBookings),
					);
				}

				// GroupSession (people → bookings): block if hosting upcoming sessions
				const activeGroupSessions = await tx.groupSession.count({
					where: {
						employeeId: cmd.employeeId,
						status: { in: ["OPEN", "FULL"] },
					},
				});
				if (activeGroupSessions > 0) {
					throw new ConflictException(
						DELETE_EMPLOYEE_MESSAGES.hostingGroupSessions(activeGroupSessions),
					);
				}

				// Invoice (people → finance): block if unpaid invoices exist
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

				// Waitlist (people → bookings)
				const waitlistEntries = await tx.waitlistEntry.count({
					where: { employeeId: cmd.employeeId, status: "WAITING" },
				});
				if (waitlistEntries > 0) {
					throw new ConflictException(
						DELETE_EMPLOYEE_MESSAGES.hasWaitlistEntries(waitlistEntries),
					);
				}

				// Rating (people → organization)
				const ratings = await tx.rating.count({
					where: { employeeId: cmd.employeeId },
				});
				if (ratings > 0) {
					throw new ConflictException(
						DELETE_EMPLOYEE_MESSAGES.hasRatings(ratings),
					);
				}

				await tx.employee.delete({ where: { id: cmd.employeeId } });
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
		);
	}
}
