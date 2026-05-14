import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

export type ListBranchEmployeesQuery = { branchId: string };

@Injectable()
export class ListBranchEmployeesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: ListBranchEmployeesQuery) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const links = await this.prisma.employeeBranch.findMany({
      where: { branchId: dto.branchId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            nameEn: true,
            email: true,
            specialty: true,
            specialtyAr: true,
            isActive: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return links.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      branchId: l.branchId,
      employee: {
        id: l.employee.id,
        isActive: l.employee.isActive,
        specialty: l.employee.specialty,
        specialtyAr: l.employee.specialtyAr,
        name: l.employee.nameAr ?? l.employee.name,
        nameEn: l.employee.nameEn ?? l.employee.name,
        email: l.employee.email,
      },
    }));
  }
}
