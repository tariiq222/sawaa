import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type DeleteBranchCommand = { branchId: string };

@Injectable()
export class DeleteBranchHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: DeleteBranchCommand) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const linkedEmployees = await this.prisma.employeeBranch.count({
      where: { branchId: dto.branchId },
    });
    if (linkedEmployees > 0) {
      throw new ConflictException(
        `Cannot delete branch: ${linkedEmployees} employee(s) still assigned. Unassign them first.`,
      );
    }

    await this.prisma.branch.delete({ where: { id: dto.branchId } });
    return { id: dto.branchId };
  }
}
