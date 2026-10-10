import { CacheService } from '../../../infrastructure/cache';
import { SERVICES_CACHE_PREFIX } from '../../org-experience/services/services.cache';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { AssignEmployeeToBranchDto } from './assign-employee-to-branch.dto';

export type AssignEmployeeToBranchCommand = AssignEmployeeToBranchDto & {
  branchId: string;
};

@Injectable()
export class AssignEmployeeToBranchHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: AssignEmployeeToBranchCommand) {
    const [branch, employee] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { id: dto.branchId },
        select: { id: true },
      }),
      this.prisma.employee.findFirst({
        where: { id: dto.employeeId },
        select: { id: true },
      }),
    ]);
    if (!branch) throw new NotFoundException('Branch not found');
    if (!employee) throw new NotFoundException('Employee not found');

    try {
      const result = await this.prisma.employeeBranch.create({
        data: {
          branchId: dto.branchId,
          employeeId: dto.employeeId,
        },
      });
      await this.cache.invalidatePrefix(SERVICES_CACHE_PREFIX);
      return result;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Employee is already assigned to this branch');
      }
      throw err;
    }
  }
}
