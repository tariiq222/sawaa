import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateIntakeFormDto } from './create-intake-form.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type CreateIntakeFormCommand = CreateIntakeFormDto;

@Injectable()
export class CreateIntakeFormHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: CreateIntakeFormCommand) {
    const _organizationId = DEFAULT_ORGANIZATION_ID;
    return this.prisma.intakeForm.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        type: dto.type,
        scope: dto.scope,
        scopeId: dto.scopeId,
        isActive: dto.isActive,
        fields: dto.fields?.length
          ? {
              create: dto.fields.map((f, i) => ({
                labelAr: f.labelAr,
                labelEn: f.labelEn,
                fieldType: f.fieldType,
                isRequired: f.isRequired ?? false,
                options: f.options ?? undefined,
                position: f.position ?? i,
              })),
            }
          : undefined,
      },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
  }
}
