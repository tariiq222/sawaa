import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { BRANCHES_CACHE_PREFIX } from './branches.cache';

export type DeleteBranchCommand = { branchId: string };

@Injectable()
export class DeleteBranchHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
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

    // Booking/WaitlistEntry/GroupSession carry branchId as a plain cross-BC
    // string with no FK, so the DB will not block deletion — guard manually to
    // avoid leaving rows pointing at a non-existent branch.
    const [linkedBookings, linkedWaitlist, linkedGroupSessions] = await Promise.all([
      this.prisma.booking.count({ where: { branchId: dto.branchId } }),
      this.prisma.waitlistEntry.count({ where: { branchId: dto.branchId } }),
      this.prisma.groupSession.count({ where: { branchId: dto.branchId } }),
    ]);
    if (linkedBookings > 0 || linkedWaitlist > 0 || linkedGroupSessions > 0) {
      throw new ConflictException(
        `Cannot delete branch: ${linkedBookings} booking(s), ${linkedWaitlist} waitlist entr(ies), and ${linkedGroupSessions} group session(s) reference it.`,
      );
    }

    await this.prisma.branch.delete({ where: { id: dto.branchId } });

    await this.cache.invalidatePrefix(BRANCHES_CACHE_PREFIX);

    return { id: dto.branchId };
  }
}
