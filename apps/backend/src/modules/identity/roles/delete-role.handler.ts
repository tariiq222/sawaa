import { Injectable, NotFoundException } from "@nestjs/common";
import {
	PrismaService,
	RlsTransactionService,
} from "../../../infrastructure/database";

export interface DeleteRoleCommand {
	customRoleId: string;
}

// رسائل الحذف بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const DELETE_ROLE_MESSAGES = {
	notFound: (id: string) => `الدور رقم ${id} غير موجود`,
} as const;

@Injectable()
export class DeleteRoleHandler {
	constructor(
		private readonly prisma: PrismaService,
		private readonly rlsTransaction: RlsTransactionService,
	) {}

	async execute(cmd: DeleteRoleCommand): Promise<void> {
		const role = await this.prisma.customRole.findFirst({
			where: { id: cmd.customRoleId },
			select: { id: true },
		});
		if (!role)
			throw new NotFoundException(
				DELETE_ROLE_MESSAGES.notFound(cmd.customRoleId),
			);

		await this.rlsTransaction.withTransaction((tx) =>
			Promise.all([
				tx.user.updateMany({
					where: { customRoleId: cmd.customRoleId },
					data: { customRoleId: null },
				}),
				tx.customRole.delete({ where: { id: cmd.customRoleId } }),
			]),
		);
	}
}
