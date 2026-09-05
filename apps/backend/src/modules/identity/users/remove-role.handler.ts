import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";
import { actorRankOf, targetRankOf } from "../shared/role-rank";

export interface RemoveRoleCommand {
	// actorUserId comes from the authenticated principal (req.user.id), never the body.
	actorUserId: string;
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
		if (cmd.actorUserId === cmd.userId) throw new ForbiddenException("Cannot change your own role");
		// Rank gate (mirrors UpdateUserRoleHandler): an actor may not strip a role
		// from a user at or above their own rank. Without this check any actor with
		// role-management permission could remove a higher-ranked user's role.
		const [actor, target] = await Promise.all([
			this.prisma.user.findUnique({
				where: { id: cmd.actorUserId },
				select: { role: true, isSuperAdmin: true },
			}),
			this.prisma.user.findUnique({
				where: { id: cmd.userId },
				select: { role: true, isSuperAdmin: true },
			}),
		]);
		if (!actor) throw new ForbiddenException("Actor not found");
		if (!target) {
			throw new NotFoundException(
				REMOVE_ROLE_MESSAGES.notAssigned(cmd.userId, cmd.customRoleId),
			);
		}
		if (actorRankOf(actor) <= targetRankOf(target)) {
			throw new ForbiddenException("Cannot modify a user at or above your rank");
		}

		const { count } = await this.prisma.user.updateMany({
			where: { id: cmd.userId, customRoleId: cmd.customRoleId },
			data: { customRoleId: null, tokenVersion: { increment: 1 } },
		});
		if (count === 0) {
			throw new NotFoundException(
				REMOVE_ROLE_MESSAGES.notAssigned(cmd.userId, cmd.customRoleId),
			);
		}
	}
}
