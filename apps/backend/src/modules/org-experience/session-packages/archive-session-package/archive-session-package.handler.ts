import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { CacheService } from '../../../../infrastructure/cache';
import { PUBLIC_PACKAGES_CACHE_KEY } from '../list-public-packages/public-packages.cache';

export type ArchiveSessionPackageCommand = { packageId: string };

/**
 * Soft-archive a SessionPackage: stamps `archivedAt = now()` and flips
 * `isActive = false`. Preserves the historical row for audit / refund
 * flows; the package disappears from list / get endpoints (those filter
 * `archivedAt: null`).
 */
@Injectable()
export class ArchiveSessionPackageHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: ArchiveSessionPackageCommand) {
    const existing = await this.prisma.sessionPackage.findFirst({
      where: { id: dto.packageId, archivedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Session package not found');
    }

    await this.prisma.sessionPackage.update({
      where: { id: dto.packageId },
      data: { archivedAt: new Date(), isActive: false },
    });

    await this.cache.invalidatePrefix(PUBLIC_PACKAGES_CACHE_KEY);

    return { id: dto.packageId };
  }
}