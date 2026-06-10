import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";

export interface DeleteIntakeFormCommand {
	formId: string;
}

// رسائل الحذف بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const DELETE_INTAKE_FORM_MESSAGES = {
	notFound: "نموذج الاستبيان غير موجود",
} as const;

@Injectable()
export class DeleteIntakeFormHandler {
	constructor(private readonly prisma: PrismaService) {}

	async execute({ formId }: DeleteIntakeFormCommand): Promise<void> {
		const form = await this.prisma.intakeForm.findFirst({
			where: { id: formId },
			select: { id: true },
		});

		if (!form) {
			throw new NotFoundException(DELETE_INTAKE_FORM_MESSAGES.notFound);
		}

		await this.prisma.intakeForm.delete({ where: { id: formId } });
	}
}
