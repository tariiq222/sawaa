import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/database';

export interface StaffTarget {
  userId: string;
  role: string;
}

export interface GetStaffTargetsQuery {
  organizationId: string;
  roles: string[];
  /** If provided, include this specific userId regardless of role (for assigned employee) */
  includeUserId?: string;
}

@Injectable()
export class GetStaffTargetsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetStaffTargetsQuery): Promise<StaffTarget[]> {
    // Membership model removed in single-tenant mode — return empty targets
    const targets: StaffTarget[] = [];

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
