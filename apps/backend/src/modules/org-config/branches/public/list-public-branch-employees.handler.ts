import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

export interface PublicBranchEmployee {
  id: string;
  slug: string | null;
  nameAr: string | null;
  nameEn: string | null;
  title: string | null;
  specialty: string | null;
  specialtyAr: string | null;
  publicBioAr: string | null;
  publicBioEn: string | null;
  publicImageUrl: string | null;
}

@Injectable()
export class ListPublicBranchEmployeesHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(branchId: string): Promise<PublicBranchEmployee[]> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, isActive: true },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const links = await this.prisma.employeeBranch.findMany({
      where: { branchId },
      select: {
        employee: {
          select: {
            id: true,
            slug: true,
            nameAr: true,
            nameEn: true,
            title: true,
            specialty: true,
            specialtyAr: true,
            publicBioAr: true,
            publicBioEn: true,
            publicImageUrl: true,
            isPublic: true,
            isActive: true,
          },
        },
      },
    });

    return links
      .filter((l) => l.employee.isPublic && l.employee.isActive)
      .map((l) => {
        const { isPublic: _ip, isActive: _ia, ...e } = l.employee;
        return e;
      });
  }
}
