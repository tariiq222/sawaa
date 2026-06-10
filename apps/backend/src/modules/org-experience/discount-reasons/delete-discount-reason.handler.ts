import {
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";

export interface DeleteDiscountReasonCommand {
	id: string;
}

// رسائل الحذف بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const DELETE_DISCOUNT_REASON_MESSAGES = {
	notFound: "سبب الخصم غير موجود",
	referencedByInvoices:
		"سبب الخصم هذا مشار إليه في فواتير موجودة. يرجى إلغاء تفعيله بدلاً من حذفه للحفاظ على سجل التدقيق.",
} as const;

@Injectable()
export class DeleteDiscountReasonHandler {
	constructor(private readonly prisma: PrismaService) {}

	async execute({ id }: DeleteDiscountReasonCommand) {
		const reason = await this.prisma.discountReason.findUnique({
			where: { id },
			select: { id: true },
		});
		if (!reason)
			throw new NotFoundException(DELETE_DISCOUNT_REASON_MESSAGES.notFound);

		// Reason may already be referenced by historical invoices. Deleting it would
		// orphan that audit trail, so block hard-delete and steer to deactivation.
		const usedBy = await this.prisma.invoice.findFirst({
			where: { discountReasonId: id },
			select: { id: true },
		});
		if (usedBy) {
			throw new ConflictException(
				DELETE_DISCOUNT_REASON_MESSAGES.referencedByInvoices,
			);
		}

		await this.prisma.discountReason.delete({ where: { id } });
		return { id };
	}
}
