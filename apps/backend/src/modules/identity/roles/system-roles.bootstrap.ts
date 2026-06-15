import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UserRole } from '@prisma/client';
import { BUILT_IN } from '../casl/built-in-rules';

// Only bootstrap roles that exist in the UserRole enum AND should be editable.
// SUPER_ADMIN: always manage:all from code, never from DB.
// CLIENT: managed by ClientSessionGuard, not the dashboard JWT guard.
// OWNER: not in the UserRole enum — skip.
const SYSTEM_ROLE_NAMES: Partial<Record<UserRole, string>> = {
  [UserRole.ADMIN]: 'مدير',
  [UserRole.RECEPTIONIST]: 'موظف استقبال',
  [UserRole.ACCOUNTANT]: 'محاسب',
  [UserRole.EMPLOYEE]: 'موظف',
};

@Injectable()
export class SystemRolesBootstrap implements OnModuleInit {
  private readonly logger = new Logger(SystemRolesBootstrap.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    for (const [roleKey, arabicName] of Object.entries(SYSTEM_ROLE_NAMES) as [UserRole, string][]) {
      const rules = BUILT_IN[roleKey] ?? [];

      // Flatten array actions → individual permission rows
      const flatPermissions: Array<{ action: string; subject: string }> = [];
      for (const rule of rules) {
        const actions = Array.isArray(rule.action) ? rule.action : [rule.action];
        for (const action of actions) {
          // Defense-in-depth: never seed manage:all or subject=all
          if (String(action).toLowerCase() === 'manage' && String(rule.subject).toLowerCase() === 'all') continue;
          if (String(rule.subject).toLowerCase() === 'all') continue;
          flatPermissions.push({ action: String(action), subject: String(rule.subject) });
        }
      }

      const existing = await this.prisma.customRole.findFirst({
        where: { systemKey: roleKey },
        select: { id: true },
      });

      if (!existing) {
        await this.prisma.customRole.create({
          data: {
            name: arabicName,
            isSystem: true,
            systemKey: roleKey,
            permissions: { create: flatPermissions },
          },
        });
        this.logger.log(`Created system role: ${roleKey}`);
      } else {
        // Sync permissions: delete old, insert new (idempotent) — onModuleInit bootstrap, no user RLS context
        // eslint-disable-next-line no-restricted-syntax
        await this.prisma.$transaction([
          this.prisma.permission.deleteMany({ where: { customRoleId: existing.id } }),
          this.prisma.permission.createMany({
            data: flatPermissions.map((p) => ({ ...p, customRoleId: existing.id })),
          }),
        ]);
        this.logger.log(`Synced system role: ${roleKey}`);
      }
    }
  }
}
