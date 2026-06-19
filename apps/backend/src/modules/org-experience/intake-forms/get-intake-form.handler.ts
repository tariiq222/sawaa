import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { parseEntityRef } from '../../../common/parse-entity-ref';

export type GetIntakeFormCommand = { formId: string };

@Injectable()
export class GetIntakeFormHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: GetIntakeFormCommand) {
    const idf = parseEntityRef(dto.formId, 'FRM');
    const form = await this.prisma.intakeForm.findFirst({
      where: idf.kind === 'uuid' ? { id: idf.id } : { ref: idf.ref },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
    if (!form) throw new NotFoundException('Intake form not found');
    return form;
  }
}
