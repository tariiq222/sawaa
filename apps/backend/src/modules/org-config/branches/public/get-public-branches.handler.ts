import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

export interface PublicBranchItem {
  id: string;
  nameAr: string;
  nameEn: string | null;
  city: string | null;
  addressAr: string | null;
  isMain: boolean;
}

@Injectable()
export class GetPublicBranchesHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(): Promise<PublicBranchItem[]> {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        city: true,
        addressAr: true,
        isMain: true,
      },
    });
  }
}
