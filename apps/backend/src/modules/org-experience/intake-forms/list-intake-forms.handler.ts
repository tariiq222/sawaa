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
        _count: {
          select: {
            responses: { where: { supersededAt: null } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const ids = (scope: string) => [...new Set(forms.filter(f => f.scope === scope && f.scopeId).map(f => f.scopeId!))];
    const [services, employees, branches] = await Promise.all([
      ids('SERVICE').length ? this.prisma.service.findMany({ where: { id: { in: ids('SERVICE') } }, select: { id: true, nameAr: true } }) : [],
      ids('EMPLOYEE').length ? this.prisma.employee.findMany({ where: { id: { in: ids('EMPLOYEE') } }, select: { id: true, name: true } }) : [],
      ids('BRANCH').length ? this.prisma.branch.findMany({ where: { id: { in: ids('BRANCH') } }, select: { id: true, nameAr: true } }) : [],
    ]);
    const labels = {
      SERVICE: new Map(services.map(s => [s.id, s.nameAr])),
      EMPLOYEE: new Map(employees.map(e => [e.id, e.name])),
      BRANCH: new Map(branches.map(b => [b.id, b.nameAr])),
    };
    return forms.map((form) => ({
      ...mapIntakeFormResult(form),
      type: form.type.toLowerCase(),
      scope: form.scope.toLowerCase(),
      fieldsCount: form.fields.length,
      scopeLabel: form.scope === 'GLOBAL' || !form.scopeId ? null : labels[form.scope].get(form.scopeId) ?? null,
    }));
  }
}
