import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type UnassignEmployeeFromBranchCommand = {
  branchId: string;
  employeeId: string;
};

@Injectable()
export class UnassignEmployeeFromBranchHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: UnassignEmployeeFromBranchCommand) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const link = await this.prisma.employeeBranch.findFirst({
      where: {
        branchId: dto.branchId,
        employeeId: dto.employeeId,
      },
      select: { id: true },
    });
    if (!link) throw new NotFoundException('Assignment not found');

    await this.prisma.employeeBranch.delete({ where: { id: link.id } });
    return { id: link.id };
  }
}
