import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService, RlsTransactionService } from "../../../infrastructure/database";
import { toIntakeRevisionData } from "../../../common/database/intake-response-history.helper";

export interface DeleteIntakeFormCommand {
	formId: string;
}

// رسائل الحذف بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const DELETE_INTAKE_FORM_MESSAGES = {
	notFound: "نموذج الاستبيان غير موجود",
} as const;

@Injectable()
export class DeleteIntakeFormHandler {
	constructor(
		private readonly prisma: PrismaService,
		private readonly rlsTransaction: RlsTransactionService,
	) {}

	async execute({ formId }: DeleteIntakeFormCommand): Promise<void> {
		const form = await this.prisma.intakeForm.findFirst({
			where: { id: formId },
			select: { id: true },
		});

		if (!form) {
			throw new NotFoundException(DELETE_INTAKE_FORM_MESSAGES.notFound);
		}

		await this.rlsTransaction.withTransaction(async (tx) => {
			const lockedForm = await tx.$queryRaw<Array<{ id: string }>>`
				SELECT "id" FROM "IntakeForm" WHERE "id" = ${formId} FOR UPDATE
			`;
			if (lockedForm.length === 0) {
				throw new NotFoundException(DELETE_INTAKE_FORM_MESSAGES.notFound);
			}

			const responses = await tx.intakeResponse.findMany({
				where: { formId },
				select: { id: true, bookingId: true, formId: true, clientId: true, answers: true },
			});
			if (responses.length > 0) {
				await tx.intakeResponseRevision.createMany({
					data: responses.map((response) =>
						toIntakeRevisionData(response, 'AUTHORIZED_DELETE'),
					),
				});
			}

			await tx.intakeForm.delete({ where: { id: formId } });
		});
	}
}
