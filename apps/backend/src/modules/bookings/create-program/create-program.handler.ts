import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ProgramStatus, Prisma } from '@prisma/client';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../infrastructure/database';
import { CreateProgramDto } from './create-program.dto';

export interface CreateProgramCommand extends CreateProgramDto {
  createdBy: string;
}

@Injectable()
export class CreateProgramHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: CreateProgramCommand) {
    if (cmd.minParticipants > cmd.maxParticipants) {
      throw new BadRequestException(
        'minParticipants cannot exceed maxParticipants',
      );
    }
    if (cmd.depositEnabled && cmd.depositAmount != null) {
      if (cmd.depositAmount > cmd.price) {
        throw new BadRequestException(
          'depositAmount cannot exceed program price',
        );
      }
    }

    return this.rlsTransaction.withTransaction(async (tx) => {
      const [department, branch, supervisors] = await Promise.all([
        tx.department.findFirst({ where: { id: cmd.departmentId } }),
        tx.branch.findFirst({ where: { id: cmd.branchId } }),
        tx.employee.findMany({
          where: { id: { in: cmd.supervisorIds } },
          select: { id: true },
        }),
      ]);
      if (!department) {
        throw new NotFoundException(`Department ${cmd.departmentId} not found`);
      }
      if (!branch) {
        throw new NotFoundException(`Branch ${cmd.branchId} not found`);
      }
      if (supervisors.length !== cmd.supervisorIds.length) {
        const found = new Set(supervisors.map((s) => s.id));
        const missing = cmd.supervisorIds.filter((id) => !found.has(id));
        throw new NotFoundException(
          `Supervisor(s) not found: ${missing.join(', ')}`,
        );
      }

      const program = await tx.program.create({
        data: {
          departmentId: cmd.departmentId,
          branchId: cmd.branchId,
          nameAr: cmd.nameAr,
          nameEn: cmd.nameEn ?? null,
          descriptionAr: cmd.descriptionAr ?? null,
          descriptionEn: cmd.descriptionEn ?? null,
          daysCount: cmd.daysCount,
          hoursPerDay: cmd.hoursPerDay,
          minParticipants: cmd.minParticipants,
          maxParticipants: cmd.maxParticipants,
          price: new Prisma.Decimal(cmd.price),
          currency: cmd.currency ?? 'SAR',
          depositEnabled: cmd.depositEnabled ?? false,
          depositAmount:
            cmd.depositAmount != null
              ? new Prisma.Decimal(cmd.depositAmount)
              : null,
          status: ProgramStatus.DRAFT,
          isPublic: cmd.isPublic ?? false,
          publicDescriptionAr: cmd.publicDescriptionAr ?? null,
          publicDescriptionEn: cmd.publicDescriptionEn ?? null,
          supervisors: {
            create: cmd.supervisorIds.map((employeeId) => ({ employeeId })),
          },
        },
        include: { supervisors: { select: { employeeId: true } } },
      });

      return {
        id: program.id,
        ref: program.ref,
        status: program.status,
        supervisorIds: program.supervisors.map((s) => s.employeeId),
      };
    });
  }
}
