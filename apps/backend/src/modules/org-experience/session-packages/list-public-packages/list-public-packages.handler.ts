import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database';
import { CacheService } from '../../../../infrastructure/cache';
import { MinioService } from '../../../../infrastructure/storage/minio.service';
import { ComputePackagePriceService } from '../../compute-package-price.service';
import { signMediaImageUrl } from '../../../media/media-image-url.helper';
import {
  PUBLIC_PACKAGES_CACHE_KEY,
  PUBLIC_PACKAGES_CACHE_TTL_SECONDS,
} from './public-packages.cache';

/**
 * Public, unauthenticated catalog of sellable session packages.
 *
 * Surfaces ONLY packages that are simultaneously:
 *   - isPublic   = true   (admin-only/private packages stay hidden)
 *   - isActive   = true   (deactivated packages are not sellable)
 *   - archivedAt = null   (archived packages are gone)
 *
 * Each entry is decorated with the canonical computed price
 * (subtotal / discountAmount / finalPrice + per-item unit prices) via the SAME
 * ComputePackagePriceService the dashboard + reception sale use, so the catalog
 * price the client sees is identical to what gets frozen at purchase time.
 *
 * Ordered by (sortOrder asc, createdAt desc) to match the dashboard list order.
 *
 * Read-through cached (P1-20): the catalog is unauthenticated slow-changing
 * reference data, so the whole computed payload is cached under a single fixed
 * key for {@link PUBLIC_PACKAGES_CACHE_TTL_SECONDS}. Cache failures fall through
 * to the loader (best-effort). Invalidate with
 * `CacheService.invalidatePrefix(PUBLIC_PACKAGES_CACHE_KEY)` from the package /
 * department / category / duration-option mutation handlers.
 */
@Injectable()
export class ListPublicPackagesHandler {
  private readonly mediaBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: ComputePackagePriceService,
    private readonly cache: CacheService,
    private readonly storage: MinioService,
    config: ConfigService,
  ) {
    this.mediaBucket = config.getOrThrow<string>('MINIO_BUCKET');
  }

  async execute() {
    return this.cache.getOrSet(
      PUBLIC_PACKAGES_CACHE_KEY,
      () => this.load(),
      PUBLIC_PACKAGES_CACHE_TTL_SECONDS,
    );
  }

  private async load() {
    const packages = await this.prisma.sessionPackage.findMany({
      where: { isPublic: true, isActive: true, archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { constraints: { include: { targets: true } } },
        },
      },
    });

    // Price every package in ONE batched lookup set (P1-4): the public catalog
    // is unauthenticated + cacheable, so a per-package compute() would fan out
    // 3 × Σ items queries on every page load. computeMany collapses that to 3.
    const prices = await this.pricing.computeMany(
      packages.map((pkg) =>
        pkg.items.map((i) => ({
          serviceId: i.serviceId,
          employeeId: i.employeeId,
          durationOptionId: i.durationOptionId,
          unitPrice: i.unitPrice != null ? Number(i.unitPrice) : null,
          paidQuantity: i.paidQuantity,
          freeQuantity: i.freeQuantity,
          discountType: i.discountType,
          discountValue: Number(i.discountValue),
        })),
      ),
      { strict: false },
    );
    return Promise.all(packages.map(async (pkg, idx) => ({
      ...pkg,
      imageUrl: await signMediaImageUrl(this.storage, this.mediaBucket, pkg.imageUrl),
      price: prices[idx],
    })));
  }
}
