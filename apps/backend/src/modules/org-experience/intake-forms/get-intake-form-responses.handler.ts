import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetIntakeFormResponsesCommand {
  bookingId: string;
}

interface ResolvedScope {
  scopeLabel: string | null;
  serviceId: string | null;
  employeeId: string | null;
  branchId: string | null;
}

@Injectable()
export class GetIntakeFormResponsesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ bookingId }: GetIntakeFormResponsesCommand) {
    const responses = await this.prisma.intakeResponse.findMany({
      where: { bookingId, supersededAt: null },
      include: {
        form: {
          include: {
            fields: { orderBy: { position: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve scope labels + counts once per distinct form.
    const formIds = [...new Set(responses.map((r) => r.formId))];
    const distinctForms = responses.filter(
      (response, index, all) => all.findIndex((item) => item.formId === response.formId) === index,
    );
    const serviceIds = [...new Set(distinctForms.flatMap((response) =>
      response.form.scope === 'SERVICE' && response.form.scopeId ? [response.form.scopeId] : [],
    ))];
    const employeeIds = [...new Set(distinctForms.flatMap((response) =>
      response.form.scope === 'EMPLOYEE' && response.form.scopeId ? [response.form.scopeId] : [],
    ))];
    const branchIds = [...new Set(distinctForms.flatMap((response) =>
      response.form.scope === 'BRANCH' && response.form.scopeId ? [response.form.scopeId] : [],
    ))];

    const [services, employees, branches, grouped] = await Promise.all([
      serviceIds.length > 0
        ? this.prisma.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, nameAr: true },
          })
        : Promise.resolve([]),
      employeeIds.length > 0
        ? this.prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      branchIds.length > 0
        ? this.prisma.branch.findMany({
            where: { id: { in: branchIds } },
            select: { id: true, nameAr: true },
          })
        : Promise.resolve([]),
      formIds.length > 0
        ? this.prisma.intakeResponse.groupBy({
        by: ['formId'],
        where: { formId: { in: formIds }, supersededAt: null },
        _count: true,
          })
        : Promise.resolve([]),
    ]);

    const serviceNameById = new Map(services.map((service) => [service.id, service.nameAr]));
    const employeeNameById = new Map(employees.map((employee) => [employee.id, employee.name]));
    const branchNameById = new Map(branches.map((branch) => [branch.id, branch.nameAr]));
    const scopeByForm = new Map<string, ResolvedScope>();
    const countByForm = new Map(grouped.map((group) => [group.formId, group._count]));
    const emptyScope: ResolvedScope = {
      scopeLabel: null,
      serviceId: null,
      employeeId: null,
      branchId: null,
    };

    for (const response of distinctForms) {
      const { scope, scopeId } = response.form;
      if (!scopeId || scope === 'GLOBAL') {
        scopeByForm.set(response.formId, emptyScope);
      } else if (scope === 'SERVICE') {
        scopeByForm.set(response.formId, {
          ...emptyScope,
          serviceId: scopeId,
          scopeLabel: serviceNameById.get(scopeId) ?? null,
        });
      } else if (scope === 'EMPLOYEE') {
        scopeByForm.set(response.formId, {
          ...emptyScope,
          employeeId: scopeId,
          scopeLabel: employeeNameById.get(scopeId) ?? null,
        });
      } else {
        scopeByForm.set(response.formId, {
          ...emptyScope,
          branchId: scopeId,
          scopeLabel: branchNameById.get(scopeId) ?? null,
        });
      }
    }

    return responses.map((r) => {
      const scope = scopeByForm.get(r.formId) ?? { scopeLabel: null, serviceId: null, employeeId: null, branchId: null };
      return {
        id: r.id,
        formId: r.formId,
        bookingId: r.bookingId,
        clientId: r.clientId ?? '',
        answers: (r.answers as Record<string, string | string[]>) ?? {},
        createdAt: r.createdAt.toISOString(),
        form: {
          ...r.form,
          type: r.form.type.toLowerCase(),
          scope: r.form.scope.toLowerCase(),
          fieldsCount: r.form.fields.length,
          submissionsCount: countByForm.get(r.formId) ?? 0,
          scopeLabel: scope.scopeLabel,
          serviceId: scope.serviceId,
          employeeId: scope.employeeId,
          branchId: scope.branchId,
        },
      };
    });
  }

}
