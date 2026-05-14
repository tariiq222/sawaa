import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { TenantContextService } from '../../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../../common/tenant/tenant.constants";

export interface PublicBranchItem {
  id: string;
  nameAr: string;
  nameEn: string | null;
  city: string | null;
  addressAr: string | null;
}

@Injectable()
export class GetPublicBranchesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(): Promise<PublicBranchItem[]> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    return this.prisma.branch.findMany({
      where: { isActive: true, organizationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        city: true,
        addressAr: true,
      },
    });
  }
}
