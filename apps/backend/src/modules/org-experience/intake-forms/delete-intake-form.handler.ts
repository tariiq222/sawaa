import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface DeleteIntakeFormCommand {
  formId: string;
}

@Injectable()
export class DeleteIntakeFormHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute({ formId }: DeleteIntakeFormCommand): Promise<void> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const form = await this.prisma.intakeForm.findFirst({
      where: { id: formId, organizationId },
      select: { id: true },
    });

    if (!form) {
      throw new NotFoundException('Intake form not found');
    }

    await this.prisma.intakeForm.delete({ where: { id: formId } });
  }
}
