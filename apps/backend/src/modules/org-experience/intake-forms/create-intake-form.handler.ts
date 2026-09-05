import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateIntakeFormDto } from './create-intake-form.dto';
import { mapIntakeFormResult, validateIntakeFormScope } from './intake-form.helpers';

export type CreateIntakeFormCommand = CreateIntakeFormDto;

@Injectable()
export class CreateIntakeFormHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: CreateIntakeFormCommand) {
    const scopeId = await validateIntakeFormScope(this.prisma, dto.scope, dto.scopeId);
    const form = await this.prisma.intakeForm.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        type: dto.type,
        scope: dto.scope,
        scopeId,
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
      include: {
        fields: { orderBy: { position: 'asc' } },
        _count: { select: { responses: true } },
      },
    });
    return mapIntakeFormResult(form);
  }
}
