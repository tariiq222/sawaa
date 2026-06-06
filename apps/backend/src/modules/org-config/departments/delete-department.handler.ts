import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { DEPARTMENTS_CACHE_PREFIX } from './departments.cache';

export type DeleteDepartmentCommand = { departmentId: string };

@Injectable()
export class DeleteDepartmentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: DeleteDepartmentCommand) {
    const result = await this.prisma.department.deleteMany({
      where: { id: dto.departmentId },
    });

    if (result.count === 0) throw new NotFoundException('Department not found');

    await this.cache.invalidatePrefix(DEPARTMENTS_CACHE_PREFIX);

    return { deleted: true };
  }
}
