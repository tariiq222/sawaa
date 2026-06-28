import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";
import { assertCanManageUser } from "../shared/role-rank";

export interface DeactivateUserCommand {
	actorUserId: string;
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
		const [actor, user] = await Promise.all([
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
		if (!user) throw new NotFoundException(DEACTIVATE_USER_MESSAGES.notFound);

		assertCanManageUser(actor, user);

		await this.prisma.user.update({
			where: { id: cmd.userId },
			data: { isActive: false },
		});
	}
}
