import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ProgramStatus, Prisma } from '@prisma/client';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../infrastructure/database';
import { UpdateProgramDto } from './update-program.dto';
import { isProgramTerminalStatus } from '../program/program-state-machine';

/**
 * Edits an existing program. Mirrors the `CreateProgramDto` field set so
 * the dashboard edit form reuses the same payload without translation,
 * but every field is optional — partial updates are accepted.
 *
 * Refuses to mutate terminal-status programs (COMPLETED / CANCELLED) —
 * the staff cancel/publish lifecycle is the canonical way to retire a
 * program. The DRAFT / OPEN / MIN_REACHED / SCHEDULED states are all
 * editable.
 *
 * Supervisor rows are replaced atomically: delete-all then bulk-create
 * the new set inside the same transaction. Cross-cluster effects are
 * intentionally NOT triggered (no status change here, so no event
 * published — see `publish-program` / `cancel-program` for those).
 */
@Injectable()
export class UpdateProgramHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(programId: string, dto: UpdateProgramDto) {
    // Cross-field invariants — checked against the *merged* (existing + new)
    // values so the form can submit a partial change without breaking the
    // guarantee. The handler reads the row first to seed defaults.
    return this.rlsTransaction.withTransaction(async (tx) => {
      const existing = await tx.program.findUnique({ where: { id: programId } });
      if (!existing) throw new NotFoundException('Program not found');
      if (isProgramTerminalStatus(existing.status)) {
        throw new BadRequestException(
          `Cannot edit a program in terminal status '${existing.status}'`,
        );
      }

      const merged = {
        departmentId: dto.departmentId ?? existing.departmentId,
        branchId: dto.branchId ?? existing.branchId,
        daysCount: dto.daysCount ?? existing.daysCount,
        hoursPerDay: dto.hoursPerDay ?? existing.hoursPerDay,
        minParticipants: dto.minParticipants ?? existing.minParticipants,
        maxParticipants: dto.maxParticipants ?? existing.maxParticipants,
        price: dto.price ?? Number(existing.price),
        depositEnabled: dto.depositEnabled ?? existing.depositEnabled,
        depositAmount:
          dto.depositAmount !== undefined
            ? dto.depositAmount
            : existing.depositAmount
              ? Number(existing.depositAmount)
              : null,
      };

      if (merged.minParticipants > merged.maxParticipants) {
        throw new BadRequestException(
          'minParticipants cannot exceed maxParticipants',
        );
      }
      if (
        merged.depositEnabled &&
        merged.depositAmount != null &&
        merged.depositAmount > merged.price
      ) {
        throw new BadRequestException(
          'depositAmount cannot exceed program price',
        );
      }

      // Re-validate foreign keys only when the field was changed by the caller.
      if (dto.departmentId !== undefined) {
        const dept = await tx.department.findFirst({
          where: { id: dto.departmentId },
          select: { id: true },
        });
        if (!dept) {
          throw new NotFoundException(`Department ${dto.departmentId} not found`);
        }
      }
      if (dto.branchId !== undefined) {
        const branch = await tx.branch.findFirst({
          where: { id: dto.branchId },
          select: { id: true },
        });
        if (!branch) {
          throw new NotFoundException(`Branch ${dto.branchId} not found`);
        }
      }
      if (dto.supervisorIds !== undefined) {
        const found = await tx.employee.findMany({
          where: { id: { in: dto.supervisorIds } },
          select: { id: true },
        });
        if (found.length !== dto.supervisorIds.length) {
          const foundSet = new Set(found.map((e) => e.id));
          const missing = dto.supervisorIds.filter((id) => !foundSet.has(id));
          throw new NotFoundException(
            `Supervisor(s) not found: ${missing.join(', ')}`,
          );
        }
      }

      // Build the patch object — only include fields the caller actually
      // supplied. `undefined` fields are NOT passed to Prisma so the row's
      // existing values are preserved.
      const data: Prisma.ProgramUpdateInput = {};
      if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
      if (dto.branchId !== undefined) data.branchId = dto.branchId;
      if (dto.nameAr !== undefined) data.nameAr = dto.nameAr;
      if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
      if (dto.descriptionAr !== undefined) data.descriptionAr = dto.descriptionAr;
      if (dto.descriptionEn !== undefined) data.descriptionEn = dto.descriptionEn;
      if (dto.daysCount !== undefined) data.daysCount = dto.daysCount;
      if (dto.hoursPerDay !== undefined) data.hoursPerDay = dto.hoursPerDay;
      if (dto.minParticipants !== undefined) data.minParticipants = dto.minParticipants;
      if (dto.maxParticipants !== undefined) data.maxParticipants = dto.maxParticipants;
      if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
      if (dto.currency !== undefined) data.currency = dto.currency;
      if (dto.depositEnabled !== undefined) data.depositEnabled = dto.depositEnabled;
      if (dto.depositAmount !== undefined) {
        data.depositAmount =
          dto.depositAmount != null ? new Prisma.Decimal(dto.depositAmount) : null;
      }
      if (dto.isPublic !== undefined) data.isPublic = dto.isPublic;
      if (dto.publicDescriptionAr !== undefined) {
        data.publicDescriptionAr = dto.publicDescriptionAr;
      }
      if (dto.publicDescriptionEn !== undefined) {
        data.publicDescriptionEn = dto.publicDescriptionEn;
      }

      // Persist the patch first (so the row's updatedAt advances even if the
      // supervisor replace is a no-op).
      const updated = await tx.program.update({
        where: { id: programId },
        data,
        include: { supervisors: { select: { employeeId: true } } },
      });

      // Replace supervisor rows atomically when the caller sent new ids.
      if (dto.supervisorIds !== undefined) {
        await tx.programSupervisor.deleteMany({ where: { programId } });
        if (dto.supervisorIds.length > 0) {
          await tx.programSupervisor.createMany({
            data: dto.supervisorIds.map((employeeId) => ({
              programId,
              employeeId,
            })),
          });
        }
      }

      return {
        id: updated.id,
        ref: updated.ref,
        status: updated.status,
        supervisorIds:
          dto.supervisorIds !== undefined
            ? dto.supervisorIds
            : updated.supervisors.map((s) => s.employeeId),
      };
    });
  }
}