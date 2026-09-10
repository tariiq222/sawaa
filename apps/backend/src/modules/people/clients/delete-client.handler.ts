import {
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RlsTransactionService } from "../../../infrastructure/database";
import { lockPersonReferences } from "../../../common/database/person-reference-lock.helper";
import { ACTIVE_BOOKING_STATUSES } from "../../bookings/active-booking-statuses";

export interface DeleteClientCommand {
	clientId: string;
}

// رسائل الحذف بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const DELETE_CLIENT_MESSAGES = {
	notFound: "العميل غير موجود",
	hasActiveBookings: (n: number) =>
		`لا يمكن حذف العميل لوجود ${n} حجز${n === 1 ? "" : "اً"} نشط${n === 1 ? "" : "ة"}. يرجى إلغاؤها أو إتمامها أولاً.`,
	hasUnpaidInvoices: (n: number) =>
		`لا يمكن حذف العميل لوجود ${n} فاتورة${n === 1 ? "" : " غير"} مدفوعة. يرجى تسويتها أولاً.`,
	hasActiveEnrollments: (n: number) =>
		`لا يمكن حذف العميل لوجود ${n} تسجيل${n === 1 ? "" : "ات"} نشط${n === 1 ? "" : "ة"} في برامج جماعية. يرجى إلغاؤها أولاً.`,
	hasRatings: (n: number) =>
		`لا يمكن حذف العميل لوجود ${n} تقييم${n === 1 ? "" : "ات"}. يجب الحفاظ على التقييمات لأغراض التدقيق.`,
} as const;

@Injectable()
export class DeleteClientHandler {
	constructor(private readonly rlsTransaction: RlsTransactionService) {}

	async execute(cmd: DeleteClientCommand): Promise<void> {
		await this.rlsTransaction.withTransaction(
			async (tx) => {
				await lockPersonReferences(
					tx,
					[{ kind: "Client", id: cmd.clientId }],
					"delete",
				);

				const client = await tx.client.findFirst({
					where: { id: cmd.clientId, deletedAt: null },
				});
				if (!client)
					throw new NotFoundException(DELETE_CLIENT_MESSAGES.notFound);

				// ─── Cross-BC integrity guards ───────────────────────────────────────────
				const activeBookings = await tx.booking.count({
					where: {
						clientId: cmd.clientId,
						status: { in: [...ACTIVE_BOOKING_STATUSES] },
					},
				});
				if (activeBookings > 0) {
					throw new ConflictException(
						DELETE_CLIENT_MESSAGES.hasActiveBookings(activeBookings),
					);
				}

				const unpaidInvoices = await tx.invoice.count({
					where: {
						clientId: cmd.clientId,
						status: { in: ["DRAFT", "ISSUED", "PARTIALLY_PAID"] },
					},
				});
				if (unpaidInvoices > 0) {
					throw new ConflictException(
						DELETE_CLIENT_MESSAGES.hasUnpaidInvoices(unpaidInvoices),
					);
				}

				const activeEnrollments = await tx.programEnrollment.count({
					where: {
						clientId: cmd.clientId,
						booking: { status: { in: [...ACTIVE_BOOKING_STATUSES] } },
					},
				});
				if (activeEnrollments > 0) {
					throw new ConflictException(
						DELETE_CLIENT_MESSAGES.hasActiveEnrollments(activeEnrollments),
					);
				}

				const ratings = await tx.rating.count({
					where: { clientId: cmd.clientId },
				});
				if (ratings > 0) {
					throw new ConflictException(DELETE_CLIENT_MESSAGES.hasRatings(ratings));
				}

				await tx.client.update({
					where: { id: cmd.clientId },
					data: {
						deletedAt: new Date(),
						isActive: false,
						phone: null,
						notes: client.phone
							? `${client.notes ?? ""}\n[deleted-phone:${client.phone}]`.trim()
							: client.notes,
					},
				});
			},
			{
				// A fresh statement snapshot after a competing reference writer commits
				// must include the relationship that writer created.
				isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
			},
		);
	}
}
