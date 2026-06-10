import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";

export interface DeactivateUserCommand {
	userId: string;
}

// رسائل الإلغاء تفعيل بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const DEACTIVATE_USER_MESSAGES = {
	notFound: "المستخدم غير موجود",
} as const;

@Injectable()
export class DeactivateUserHandler {
	constructor(private readonly prisma: PrismaService) {}

	async execute(cmd: DeactivateUserCommand): Promise<void> {
		const user = await this.prisma.user.findUnique({
			where: { id: cmd.userId },
		});
		if (!user) throw new NotFoundException(DEACTIVATE_USER_MESSAGES.notFound);

		await this.prisma.user.update({
			where: { id: cmd.userId },
			data: { isActive: false },
		});
	}
}
