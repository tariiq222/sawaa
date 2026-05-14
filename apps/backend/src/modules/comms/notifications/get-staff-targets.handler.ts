import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database';

export interface StaffTarget {
  userId: string;
  role: string;
}

export interface GetStaffTargetsQuery {
  organizationId: string; // unused in single-tenant; kept for caller compatibility
  roles: string[];
  /** If provided, include this specific userId regardless of role (for assigned employee) */
  includeUserId?: string;
}

// Valid UserRole values as a set for fast membership checks.
const VALID_USER_ROLES = new Set<string>(Object.values(UserRole));

@Injectable()
export class GetStaffTargetsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetStaffTargetsQuery): Promise<StaffTarget[]> {
    // Callers may pass legacy role names (e.g. 'OWNER') that no longer exist in
    // the UserRole enum after the single-tenant migration. Filter them out before
    // passing to Prisma to avoid an invalid-enum runtime error.
    const validRoles = query.roles.filter((r) => VALID_USER_ROLES.has(r)) as UserRole[];

    const users = await this.prisma.user.findMany({
      where: {
        role: { in: validRoles },
        isActive: true,
      },
      select: { id: true, role: true },
    });

    const targets: StaffTarget[] = users.map((u) => ({
      userId: u.id,
      role: u.role,
    }));

    // Add the specifically assigned user if not already in list
    if (query.includeUserId) {
      const alreadyIncluded = targets.some((t) => t.userId === query.includeUserId);
      if (!alreadyIncluded) {
        targets.push({ userId: query.includeUserId, role: 'EMPLOYEE' });
      }
    }

    return targets;
  }
}
