import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface DeleteEmployeeCommand { employeeId: string; }

@Injectable()
export class DeleteEmployeeHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: DeleteEmployeeCommand): Promise<void> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId, organizationId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    await this.prisma.employee.delete({ where: { id: cmd.employeeId } });
  }
}
