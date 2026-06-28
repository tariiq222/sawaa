import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";
import { assertCanManageUser } from "../shared/role-rank";

export interface DeleteUserCommand {
	actorUserId: string;
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
		const [actor, target] = await Promise.all([
			this.prisma.user.findUnique({
				where: { id: cmd.actorUserId },
				select: { id: true, role: true, isSuperAdmin: true },
			}),
			this.prisma.user.findUnique({
				where: { id: cmd.userId },
				select: { id: true, role: true, isSuperAdmin: true },
			}),
		]);
		if (!actor) throw new ForbiddenException("Actor not found");
		if (!target) throw new NotFoundException(DELETE_USER_MESSAGES.notFound(cmd.userId));

		assertCanManageUser(actor, target);

		const { count } = await this.prisma.user.deleteMany({
			where: { id: cmd.userId },
		});
		if (count === 0)
			throw new NotFoundException(DELETE_USER_MESSAGES.notFound(cmd.userId));
	}
}
