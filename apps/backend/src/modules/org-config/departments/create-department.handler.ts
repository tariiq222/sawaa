import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { CreateDepartmentDto } from './create-department.dto';
import { DEPARTMENTS_CACHE_PREFIX } from './departments.cache';

export type CreateDepartmentCommand = CreateDepartmentDto;

@Injectable()
export class CreateDepartmentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: CreateDepartmentCommand) {
    const existing = await this.prisma.department.findFirst({
      where: { nameAr: dto.nameAr },
    });
    if (existing) {
      throw new ConflictException({
        error: 'DEPARTMENT_NAME_EXISTS',
        message: 'Department with this Arabic name already exists',
      });
    }

    const created = await this.prisma.department.create({
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

    await this.cache.invalidatePrefix(DEPARTMENTS_CACHE_PREFIX);

    return created;
  }
}
