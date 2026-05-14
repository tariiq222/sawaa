import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type GetIntakeFormCommand = { formId: string };

@Injectable()
export class GetIntakeFormHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: GetIntakeFormCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const form = await this.prisma.intakeForm.findFirst({
      where: { id: dto.formId, organizationId },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
    if (!form) throw new NotFoundException('Intake form not found');
    return form;
  }
}
