import { Injectable } from '@nestjs/common';
import { ProgramStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

/**
 * Public catalog of open programs. Filters:
 *   - isPublic = true
 *   - status in (OPEN, MIN_REACHED)
 *   - enrolledCount < maxParticipants (FULL badge is computed, not stored)
 *
 * The capacity filter is applied post-fetch — Prisma's portable query API
 * cannot compare two columns on the same row. The clinic publishes a small
 * handful of programs at a time, so the cost is acceptable.
 */
// Bound an otherwise-unlimited list query (public programs catalog).
const MAX_PUBLIC_PROGRAMS = 200;

@Injectable()
export class ListPublicProgramsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(departmentId?: string) {
    const programs = await this.prisma.program.findMany({
      where: {
        isPublic: true,
        status: { in: [ProgramStatus.OPEN, ProgramStatus.MIN_REACHED] },
        ...(departmentId ? { departmentId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: MAX_PUBLIC_PROGRAMS,
      include: {
        supervisors: { select: { employeeId: true } },
      },
    });

    return programs
      .filter((p) => p.enrolledCount < p.maxParticipants)
      .map((p) => ({
        id: p.id,
        ref: p.ref,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        descriptionAr: p.descriptionAr,
        descriptionEn: p.descriptionEn,
        publicDescriptionAr: p.publicDescriptionAr,
        publicDescriptionEn: p.publicDescriptionEn,
        departmentId: p.departmentId,
        branchId: p.branchId,
        startDate: p.startDate,
        daysCount: p.daysCount,
        hoursPerDay: p.hoursPerDay,
        minParticipants: p.minParticipants,
        maxParticipants: p.maxParticipants,
        enrolledCount: p.enrolledCount,
        price: p.price.toString(),
        currency: p.currency,
        depositEnabled: p.depositEnabled,
        depositAmount: p.depositAmount?.toString() ?? null,
        status: p.status,
        isPublic: p.isPublic,
        supervisorIds: p.supervisors.map((s) => s.employeeId),
        isFull: p.enrolledCount >= p.maxParticipants,
      }));
  }
}
