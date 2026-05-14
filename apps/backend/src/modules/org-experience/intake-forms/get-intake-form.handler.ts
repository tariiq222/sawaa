import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

export type GetIntakeFormCommand = { formId: string };

@Injectable()
export class GetIntakeFormHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: GetIntakeFormCommand) {
    const form = await this.prisma.intakeForm.findFirst({
      where: { id: dto.formId },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
    if (!form) throw new NotFoundException('Intake form not found');
    return form;
  }
}
