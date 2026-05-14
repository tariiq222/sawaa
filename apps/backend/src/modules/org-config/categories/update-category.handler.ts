import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { UpdateCategoryDto } from './update-category.dto';

export type UpdateCategoryCommand = UpdateCategoryDto & { categoryId: string };

@Injectable()
export class UpdateCategoryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpdateCategoryCommand) {
    const existing = await this.prisma.serviceCategory.findFirst({
      where: { id: dto.categoryId },
    });
    if (!existing) throw new NotFoundException('ServiceCategory not found');

    return this.prisma.serviceCategory.update({
      where: { id: dto.categoryId },
      data: {
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }
}
