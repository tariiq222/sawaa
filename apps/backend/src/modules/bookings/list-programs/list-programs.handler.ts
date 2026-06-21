import { Injectable } from '@nestjs/common';
import { ProgramStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ListProgramsQuery {
  status?: ProgramStatus;
  departmentId?: string;
  branchId?: string;
}

@Injectable()
export class ListProgramsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListProgramsQuery = {}) {
    const programs = await this.prisma.program.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        supervisors: { select: { employeeId: true } },
        _count: { select: { enrollments: true } },
      },
    });

    return programs.map((p) => ({
      id: p.id,
      ref: p.ref,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
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
      cancelledAt: p.cancelledAt,
      createdAt: p.createdAt,
      supervisorIds: p.supervisors.map((s) => s.employeeId),
      isFull: p.enrolledCount >= p.maxParticipants,
      enrollmentCount: p._count.enrollments,
    }));
  }
}
