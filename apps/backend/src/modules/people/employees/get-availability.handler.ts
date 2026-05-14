import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type GetAvailabilityCommand = { employeeId: string };

@Injectable()
export class GetAvailabilityHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: GetAvailabilityCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId, organizationId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const schedule = await this.prisma.employeeAvailability.findMany({
      where: { employeeId: cmd.employeeId, organizationId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return { schedule };
  }
}
