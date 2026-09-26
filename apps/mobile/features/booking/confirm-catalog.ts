import { getCategoryBookingServices } from '@sawaa/shared/catalog';
import type {
  PublicCatalogCategory,
  PublicCatalogDepartment,
  PublicCatalogRaw,
  PublicService,
} from '@/services/client/catalog';

export interface ConfirmCatalogSelection {
  service: PublicService | null;
  directClinic: PublicCatalogCategory | null;
}

/** Resolve only the requested clinic's bookable service; never widen a scoped selection. */
export function resolveConfirmCatalogSelection(
  catalog: PublicCatalogRaw | undefined,
  departments: PublicCatalogDepartment[] | undefined,
  clinicId: string | undefined,
  serviceId: string | undefined,
): ConfirmCatalogSelection {
  if (!serviceId) return { service: null, directClinic: null };

  if (clinicId) {
    if (!catalog) return { service: null, directClinic: null };
    const category = catalog.categories.find((item) =>
      item.id === clinicId && item.isActive !== false && item.archivedAt == null &&
      (item.kind ?? 'CLINIC') === 'CLINIC',
    );
    if (!category) return { service: null, directClinic: null };
    const service = getCategoryBookingServices(category, catalog.services)
      .find((item) => item.id === serviceId) ?? null;
    if (!service) return { service: null, directClinic: null };
    return { service, directClinic: category.bookingMode === 'DIRECT' ? category : null };
  }

  const service = departments
    ?.flatMap((department) => department.services)
    .find((item) => item.id === serviceId) ?? catalog?.services.find((item) =>
      item.id === serviceId && item.categoryId == null && item.isHidden !== true &&
      item.isActive !== false && item.archivedAt == null,
    ) ?? null;
  return { service, directClinic: null };
}

export function resolveConfirmPrice(
  service: PublicService | null,
  directClinic: PublicCatalogCategory | null,
  chargedPrice?: string,
): { subtotal: number | null; total: number } {
  const carriedPrice = chargedPrice != null && chargedPrice !== '' ? Number(chargedPrice) : null;
  const validCarriedPrice = carriedPrice != null && Number.isFinite(carriedPrice) && carriedPrice >= 0
    ? carriedPrice
    : null;
  const subtotal = directClinic
    ? validCarriedPrice
    : validCarriedPrice ?? (service ? Number(service.price) : null);
  return { subtotal, total: subtotal ?? 0 };
}
