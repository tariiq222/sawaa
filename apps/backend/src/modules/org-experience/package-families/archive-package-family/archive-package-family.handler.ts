import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { CacheService } from '../../../../infrastructure/cache';
import { PUBLIC_PACKAGES_CACHE_KEY } from '../../session-packages/list-public-packages/public-packages.cache';

/**
 * Archive a family and all of its sellable options as one catalog mutation.
 * Purchase rows, credits, and their immutable offer snapshots are deliberately
 * untouched so historical rights remain usable after catalog removal.
 */
@Injectable()
export class ArchivePackageFamilyHandler {
  constructor(
    private readonly rlsTransaction: RlsTransactionService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  async execute({ familyId }: { familyId: string }): Promise<void> {
    await this.rlsTransaction.withTransaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PackageFamily" WHERE id = ${familyId} FOR UPDATE`;
      const family = await tx.packageFamily.findUnique({ where: { id: familyId }, select: { id: true } });
      if (!family) throw new NotFoundException('Package family not found');

      const archivedAt = new Date();
      await tx.sessionPackage.updateMany({
        where: { familyId },
        data: { archivedAt, isActive: false, isPublic: false },
      });
      await tx.packageFamily.update({
        where: { id: familyId },
        data: { archivedAt, isActive: false, isPublic: false },
      });
    });

    await this.cache?.invalidatePrefix(PUBLIC_PACKAGES_CACHE_KEY);
  }
}
