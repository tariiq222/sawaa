import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { isProgramOpenForEnrollment } from '../program/program-state-machine';

/**
 * Public detail of a single program by ID. Only public programs are visible
 * (the handler treats a non-public row as NotFound regardless of status).
 */
@Injectable()
export class GetPublicProgramHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(programId: string) {
    const program = await this.prisma.program.findFirst({
      where: { id: programId, isPublic: true },
      include: {
        supervisors: { select: { employeeId: true } },
      },
    });
    if (!program) throw new NotFoundException('Program not found');

    return {
      id: program.id,
      ref: program.ref,
      nameAr: program.nameAr,
      nameEn: program.nameEn,
      descriptionAr: program.descriptionAr,
      descriptionEn: program.descriptionEn,
      publicDescriptionAr: program.publicDescriptionAr,
      publicDescriptionEn: program.publicDescriptionEn,
      departmentId: program.departmentId,
      branchId: program.branchId,
      startDate: program.startDate,
      daysCount: program.daysCount,
      hoursPerDay: program.hoursPerDay,
      minParticipants: program.minParticipants,
      maxParticipants: program.maxParticipants,
      enrolledCount: program.enrolledCount,
      price: program.price.toString(),
      currency: program.currency,
      depositEnabled: program.depositEnabled,
      depositAmount: program.depositAmount?.toString() ?? null,
      status: program.status,
      isPublic: program.isPublic,
      supervisorIds: program.supervisors.map((s) => s.employeeId),
      isFull: program.enrolledCount >= program.maxParticipants,
      isOpenForEnrollment: isProgramOpenForEnrollment(program.status),
    };
  }
}
