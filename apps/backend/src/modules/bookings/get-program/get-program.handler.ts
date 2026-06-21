import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

/**
 * Lookup a single program by UUID OR by its human ref number.
 * Both forms are accepted because the dashboard routes both `/programs/:id`
 * (UUID) and `/programs/:ref` (when the user pastes the printed ref).
 */
@Injectable()
export class GetProgramHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(programIdOrRef: string) {
    const isNumeric = /^\d+$/.test(programIdOrRef);

    const program = await this.prisma.program.findFirst({
      where: isNumeric
        ? { ref: parseInt(programIdOrRef, 10) }
        : { id: programIdOrRef },
      include: {
        supervisors: { select: { employeeId: true } },
        enrollments: {
          include: {
            booking: {
              select: {
                id: true,
                clientId: true,
                status: true,
                price: true,
                currency: true,
                scheduledAt: true,
                bookingNumber: true,
              },
            },
          },
          orderBy: { enrolledAt: 'desc' },
        },
      },
    });

    if (!program) throw new NotFoundException('Program not found');

    return {
      id: program.id,
      ref: program.ref,
      departmentId: program.departmentId,
      branchId: program.branchId,
      nameAr: program.nameAr,
      nameEn: program.nameEn,
      descriptionAr: program.descriptionAr,
      descriptionEn: program.descriptionEn,
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
      publicDescriptionAr: program.publicDescriptionAr,
      publicDescriptionEn: program.publicDescriptionEn,
      cancelReason: program.cancelReason,
      cancelledAt: program.cancelledAt,
      createdAt: program.createdAt,
      updatedAt: program.updatedAt,
      supervisorIds: program.supervisors.map((s) => s.employeeId),
      isFull: program.enrolledCount >= program.maxParticipants,
      enrollments: program.enrollments.map((e) => ({
        id: e.id,
        clientId: e.clientId,
        enrolledAt: e.enrolledAt,
        booking: {
          id: e.booking.id,
          clientId: e.booking.clientId,
          status: e.booking.status,
          price: e.booking.price.toString(),
          currency: e.booking.currency,
          scheduledAt: e.booking.scheduledAt,
          bookingNumber: e.booking.bookingNumber,
        },
      })),
    };
  }
}
