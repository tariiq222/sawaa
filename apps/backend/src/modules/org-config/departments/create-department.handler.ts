import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateDepartmentDto } from './create-department.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type CreateDepartmentCommand = CreateDepartmentDto;

@Injectable()
export class CreateDepartmentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: CreateDepartmentCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;

    const existing = await this.prisma.department.findUnique({
      where: { dept_org_nameAr: { organizationId, nameAr: dto.nameAr } },
    });
    if (existing) {
      throw new ConflictException({
        error: 'DEPARTMENT_NAME_EXISTS',
        message: 'Department with this Arabic name already exists',
      });
    }

    return this.prisma.department.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        icon: dto.icon,
        isActive: dto.isActive ?? true,
        isVisible: dto.isVisible ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }
}
