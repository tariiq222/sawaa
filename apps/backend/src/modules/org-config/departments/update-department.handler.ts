import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { UpdateDepartmentDto } from './update-department.dto';
import { DEPARTMENTS_CACHE_PREFIX } from './departments.cache';

export type UpdateDepartmentCommand = UpdateDepartmentDto & { departmentId: string };

@Injectable()
export class UpdateDepartmentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: UpdateDepartmentCommand) {
    if (dto.nameAr !== undefined) {
      const existing = await this.prisma.department.findFirst({
        where: { nameAr: dto.nameAr, id: { not: dto.departmentId } },
      });
      if (existing) {
        throw new ConflictException({
          message: 'Department with this Arabic name already exists',
          code: 'DEPARTMENT_NAME_EXISTS',
        });
      }
    }

    const result = await this.prisma.department.updateMany({
      where: { id: dto.departmentId },
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

    await this.cache.invalidatePrefix(DEPARTMENTS_CACHE_PREFIX);

    return this.prisma.department.findFirst({
      where: { id: dto.departmentId },
    });
  }
}
