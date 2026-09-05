import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListIntakeFormsDto } from './list-intake-forms.dto';
import { mapIntakeFormResult } from './intake-form.helpers';

export type ListIntakeFormsCommand = ListIntakeFormsDto;

@Injectable()
export class ListIntakeFormsHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: ListIntakeFormsCommand) {
    const forms = await this.prisma.intakeForm.findMany({
      where: {
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        fields: { orderBy: { position: 'asc' } },
        _count: { select: { responses: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return forms.map((form) => ({
      ...mapIntakeFormResult(form),
      type: form.type.toLowerCase(),
      scope: form.scope.toLowerCase(),
      fieldsCount: form.fields.length,
      scopeLabel: null, // TODO: resolve service/employee/branch name when scopeId is set
    }));
  }
}
