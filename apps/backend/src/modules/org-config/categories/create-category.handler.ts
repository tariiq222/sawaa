import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateCategoryDto } from './create-category.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type CreateCategoryCommand = CreateCategoryDto;

@Injectable()
export class CreateCategoryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: CreateCategoryCommand) {
    const _organizationId = DEFAULT_ORGANIZATION_ID;
    return this.prisma.serviceCategory.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        departmentId: dto.departmentId ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }
}
