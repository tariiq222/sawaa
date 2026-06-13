import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

export interface PublicBranchDetail {
  id: string;
  nameAr: string;
  nameEn: string | null;
  city: string | null;
  addressAr: string | null;
  addressEn: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  isMain: boolean;
  businessHours: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isOpen: boolean;
  }>;
}

@Injectable()
export class GetPublicBranchHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(branchId: string): Promise<PublicBranchDetail> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, isActive: true },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        city: true,
        addressAr: true,
        addressEn: true,
        phone: true,
        latitude: true,
        longitude: true,
        timezone: true,
        isMain: true,
        businessHours: {
          orderBy: { dayOfWeek: 'asc' },
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            isOpen: true,
          },
        },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }
}
