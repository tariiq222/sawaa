import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";

export interface RemoveRoleCommand {
	userId: string;
	customRoleId: string;
}

// رسائل إزالة الدور بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const REMOVE_ROLE_MESSAGES = {
	notAssigned: (userId: string, roleId: string) =>
		`المستخدم رقم ${userId} غير مُسنَد إليه الدور رقم ${roleId}`,
} as const;

@Injectable()
export class RemoveRoleHandler {
	constructor(private readonly prisma: PrismaService) {}

	async execute(cmd: RemoveRoleCommand): Promise<void> {
		const { count } = await this.prisma.user.updateMany({
			where: { id: cmd.userId, customRoleId: cmd.customRoleId },
			data: { customRoleId: null },
		});
		if (count === 0) {
			throw new NotFoundException(
				REMOVE_ROLE_MESSAGES.notAssigned(cmd.userId, cmd.customRoleId),
			);
		}
	}
}
