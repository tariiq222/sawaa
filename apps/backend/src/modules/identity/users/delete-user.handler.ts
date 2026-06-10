import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";

export interface DeleteUserCommand {
	userId: string;
}

// رسائل الحذف بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const DELETE_USER_MESSAGES = {
	notFound: (id: string) => `المستخدم رقم ${id} غير موجود`,
} as const;

@Injectable()
export class DeleteUserHandler {
	constructor(private readonly prisma: PrismaService) {}

	async execute(cmd: DeleteUserCommand): Promise<void> {
		const { count } = await this.prisma.user.deleteMany({
			where: { id: cmd.userId },
		});
		if (count === 0)
			throw new NotFoundException(DELETE_USER_MESSAGES.notFound(cmd.userId));
	}
}
