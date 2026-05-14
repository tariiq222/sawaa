import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { ListIntakeFormsDto } from './list-intake-forms.dto';

export type ListIntakeFormsCommand = ListIntakeFormsDto;

@Injectable()
export class ListIntakeFormsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: ListIntakeFormsCommand) {
    const forms = await this.prisma.intakeForm.findMany({
      where: {
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { fields: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return forms.map((form) => ({
      ...form,
      type: form.type.toLowerCase(),
      scope: form.scope.toLowerCase(),
      fieldsCount: form.fields.length,
      submissionsCount: 0,
      scopeLabel: null, // TODO: resolve service/employee/branch name when scopeId is set
    }));
  }
}
