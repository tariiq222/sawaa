import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { ResolveApplicableIntakeFormsDto } from './resolve-applicable-intake-forms.dto';

export type ResolveApplicableIntakeFormsCommand = ResolveApplicableIntakeFormsDto;

/**
 * Returns the ACTIVE intake forms that apply to a given booking context.
 *
 * Applicability is the union of:
 *   - scope GLOBAL                          (always applies)
 *   - scope SERVICE  with scopeId=serviceId
 *   - scope EMPLOYEE with scopeId=employeeId
 *   - scope BRANCH   with scopeId=branchId
 *
 * Optionally filtered by `type`. Each form carries its ordered fields so a
 * client surface can render and collect answers in one round-trip.
 */
@Injectable()
export class ResolveApplicableIntakeFormsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ResolveApplicableIntakeFormsCommand) {
    const scopeClauses: Prisma.IntakeFormWhereInput[] = [{ scope: 'GLOBAL' }];

    if (dto.serviceId) {
      scopeClauses.push({ scope: 'SERVICE', scopeId: dto.serviceId });
    }
    if (dto.employeeId) {
      scopeClauses.push({ scope: 'EMPLOYEE', scopeId: dto.employeeId });
    }
    if (dto.branchId) {
      scopeClauses.push({ scope: 'BRANCH', scopeId: dto.branchId });
    }

    const forms = await this.prisma.intakeForm.findMany({
      where: {
        isActive: true,
        ...(dto.type && { type: dto.type }),
        OR: scopeClauses,
      },
      include: { fields: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    return forms.map((form) => ({
      id: form.id,
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      type: form.type.toLowerCase(),
      scope: form.scope.toLowerCase(),
      scopeId: form.scopeId,
      isActive: form.isActive,
      fields: form.fields.map((f) => ({
        id: f.id,
        labelAr: f.labelAr,
        labelEn: f.labelEn,
        fieldType: f.fieldType.toLowerCase(),
        isRequired: f.isRequired,
        options: (f.options as string[] | null) ?? [],
        position: f.position,
      })),
    }));
  }
}
