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
      where: { bookingId },
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
    const scopeByForm = new Map<string, ResolvedScope>();
    const countByForm = new Map<string, number>();

    await Promise.all(
      responses
        .filter((r, i, arr) => arr.findIndex((x) => x.formId === r.formId) === i)
        .map(async (r) => {
          scopeByForm.set(r.formId, await this.resolveScope(r.form.scope, r.form.scopeId));
        }),
    );

    await Promise.all(
      formIds.map(async (formId) => {
        countByForm.set(formId, await this.prisma.intakeResponse.count({ where: { formId } }));
      }),
    );

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

  private async resolveScope(
    scope: 'GLOBAL' | 'SERVICE' | 'EMPLOYEE' | 'BRANCH',
    scopeId: string | null,
  ): Promise<ResolvedScope> {
    const empty: ResolvedScope = { scopeLabel: null, serviceId: null, employeeId: null, branchId: null };
    if (scope === 'GLOBAL' || !scopeId) {
      return empty;
    }

    if (scope === 'SERVICE') {
      const service = await this.prisma.service.findUnique({
        where: { id: scopeId },
        select: { nameAr: true },
      });
      return { ...empty, serviceId: scopeId, scopeLabel: service?.nameAr ?? null };
    }

    if (scope === 'EMPLOYEE') {
      const employee = await this.prisma.employee.findUnique({
        where: { id: scopeId },
        select: { name: true },
      });
      return { ...empty, employeeId: scopeId, scopeLabel: employee?.name ?? null };
    }

    // BRANCH
    const branch = await this.prisma.branch.findUnique({
      where: { id: scopeId },
      select: { nameAr: true },
    });
    return { ...empty, branchId: scopeId, scopeLabel: branch?.nameAr ?? null };
  }
}
