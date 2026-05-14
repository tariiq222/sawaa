import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { UpdateDepartmentDto } from './update-department.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type UpdateDepartmentCommand = UpdateDepartmentDto & { departmentId: string };

@Injectable()
export class UpdateDepartmentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpdateDepartmentCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const result = await this.prisma.department.updateMany({
      where: { id: dto.departmentId, organizationId },
      data: {
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.descriptionAr !== undefined && { descriptionAr: dto.descriptionAr }),
        ...(dto.descriptionEn !== undefined && { descriptionEn: dto.descriptionEn }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    if (result.count === 0) throw new NotFoundException('Department not found');

    return this.prisma.department.findFirst({
      where: { id: dto.departmentId, organizationId },
    });
  }
}
