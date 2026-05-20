import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetIntakeFormResponsesCommand {
  bookingId: string;
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

    return responses.map((r) => ({
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
        submissionsCount: 0,
        scopeLabel: null,
        serviceId: null,
        employeeId: null,
        branchId: null,
      },
    }));
  }
}
