import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { AssignPermissionsDto } from './assign-permissions.dto';

export type AssignPermissionsCommand = AssignPermissionsDto & {
  customRoleId: string;
};

const ASSIGN_PERMISSIONS_MESSAGES = {
  notFound: (id: string) => `Role ${id} not found`,
  godMode: 'لا يمكن منح صلاحية كاملة (manage:all) لأي دور',
} as const;

@Injectable()
export class AssignPermissionsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: AssignPermissionsCommand): Promise<void> {
    const role = await this.prisma.customRole.findFirst({
      where: { id: cmd.customRoleId },
      select: { id: true, isSystem: true, systemKey: true },
    });
    if (!role)
      throw new NotFoundException(ASSIGN_PERMISSIONS_MESSAGES.notFound(cmd.customRoleId));

    // SECURITY (privilege-escalation guard): now that system roles are writable
    // from this endpoint, reject any attempt to grant god-mode. This mirrors the
    // defense-in-depth in system-roles.bootstrap.ts which never seeds manage:all
    // or subject=all. We REJECT (not silently strip) so the caller gets a clear
    // signal, and apply it to BOTH system and custom roles for a consistent rule.
    //
    // The AssignPermissionsDto @IsIn is the primary gate: 'all' is NOT in
    // PERMISSION_SUBJECTS, so a subject:'all' body is already rejected (400) by
    // the ValidationPipe before reaching this handler. This handler check is
    // defense-in-depth — it holds even for direct/internal callers that bypass
    // the DTO, and survives any future change to the catalog.
    const grantsGodMode = cmd.permissions.some((p) => {
      const action = p.action.toLowerCase();
      const subject = p.subject.toLowerCase();
      return subject === 'all' || (action === 'manage' && subject === 'all');
    });
    if (grantsGodMode)
      throw new BadRequestException(ASSIGN_PERMISSIONS_MESSAGES.godMode);

    // Replace permissions atomically — admin handler, no per-user RLS context required for permission rows.
    // For system roles, ALSO flip permissionsCustomized so SystemRolesBootstrap stops
    // overwriting these edits from BUILT_IN on the next boot/deploy.
    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.permission.deleteMany({ where: { customRoleId: cmd.customRoleId } }),
      this.prisma.permission.createMany({
        data: cmd.permissions.map((p) => ({
          customRoleId: cmd.customRoleId,
          action: p.action,
          subject: p.subject,
        })),
      }),
    ];
    if (role.isSystem) {
      operations.push(
        this.prisma.customRole.update({
          where: { id: cmd.customRoleId },
          data: { permissionsCustomized: true },
        }),
      );
    }
    // eslint-disable-next-line no-restricted-syntax
    await this.prisma.$transaction(operations);

    // Invalidate sessions for all users affected by this permission change.
    // For system roles: bump all users with that built-in role.
    // For custom roles: bump all users assigned this custom role.
    if (role.isSystem && role.systemKey) {
      await this.prisma.user.updateMany({
        where: { role: role.systemKey },
        data: { tokenVersion: { increment: 1 } },
      });
    } else {
      await this.prisma.user.updateMany({
        where: { customRoleId: cmd.customRoleId },
        data: { tokenVersion: { increment: 1 } },
      });
    }
  }
}
