import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { TenantContextService } from '../../../../common/tenant';

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
    return this.prisma.branch.findMany({
      where: { isActive: true },
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
