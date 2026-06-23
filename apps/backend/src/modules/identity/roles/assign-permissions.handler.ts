import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { AssignPermissionsDto } from './assign-permissions.dto';

export type AssignPermissionsCommand = AssignPermissionsDto & {
  customRoleId: string;
};

const ASSIGN_PERMISSIONS_MESSAGES = {
  notFound: (id: string) => `Role ${id} not found`,
  isSystem: 'لا يمكن تعديل صلاحيات دور النظام',
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
    // IDENT-005: built-in/system roles are immutable from the permissions API.
    // Their permissions are reset from BUILT_IN on boot, so a write here would be
    // silently lost — and worse, allow tampering with privileged roles. Mirror
    // delete-role.handler which also refuses to mutate system roles.
    if (role.isSystem)
      throw new ForbiddenException(ASSIGN_PERMISSIONS_MESSAGES.isSystem);

    // Replace permissions atomically — admin handler, no per-user RLS context required for permission rows
    // eslint-disable-next-line no-restricted-syntax
    await this.prisma.$transaction([
      this.prisma.permission.deleteMany({ where: { customRoleId: cmd.customRoleId } }),
      this.prisma.permission.createMany({
        data: cmd.permissions.map((p) => ({
          customRoleId: cmd.customRoleId,
          action: p.action,
          subject: p.subject,
        })),
      }),
    ]);

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
