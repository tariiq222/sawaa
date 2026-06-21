import {
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";

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
	constructor(private readonly prisma: PrismaService) {}

	async execute(cmd: DeleteClientCommand) {
		const client = await this.prisma.client.findFirst({
			where: { id: cmd.clientId, deletedAt: null },
		});
		if (!client) throw new NotFoundException(DELETE_CLIENT_MESSAGES.notFound);

		// ─── Cross-BC integrity guards ───────────────────────────────────────────
		// Booking (people → bookings): block if any active appointment exists
		const activeBookings = await this.prisma.booking.count({
			where: {
				clientId: cmd.clientId,
				status: {
					in: [
						"PENDING",
						"AWAITING_PAYMENT",
						"CONFIRMED",
						"CANCEL_REQUESTED",
					],
				},
			},
		});
		if (activeBookings > 0) {
			throw new ConflictException(
				DELETE_CLIENT_MESSAGES.hasActiveBookings(activeBookings),
			);
		}

		// Invoice (people → finance): block if unpaid invoices exist
		const unpaidInvoices = await this.prisma.invoice.count({
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

		// ProgramEnrollment (people → bookings)
		const activeEnrollments = await this.prisma.programEnrollment.count({
			where: {
				clientId: cmd.clientId,
				booking: {
					status: {
						in: [
							"PENDING",
							"AWAITING_PAYMENT",
							"CONFIRMED",
							"CANCEL_REQUESTED",
						],
					},
				},
			},
		});
		if (activeEnrollments > 0) {
			throw new ConflictException(
				DELETE_CLIENT_MESSAGES.hasActiveEnrollments(activeEnrollments),
			);
		}

		// Rating (people → organization)
		const ratings = await this.prisma.rating.count({
			where: { clientId: cmd.clientId },
		});
		if (ratings > 0) {
			throw new ConflictException(DELETE_CLIENT_MESSAGES.hasRatings(ratings));
		}

		// Soft delete: set deletedAt, force inactive, and null the phone so the
		// unique phone constraint no longer blocks re-creating a client with the same
		// number. The original phone is preserved in notes for audit.
		await this.prisma.client.update({
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
	}
}
