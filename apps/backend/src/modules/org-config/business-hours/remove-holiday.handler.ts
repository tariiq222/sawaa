import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type RemoveHolidayCommand = { holidayId: string };

@Injectable()
export class RemoveHolidayHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: RemoveHolidayCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const holiday = await this.prisma.holiday.findFirst({
      where: { id: dto.holidayId, organizationId },
    });
    if (!holiday) throw new NotFoundException('Holiday not found');

    await this.prisma.holiday.delete({ where: { id: dto.holidayId } });
    return { deleted: true };
  }
}
