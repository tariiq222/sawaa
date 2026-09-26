export type CategoryBookingMode = 'DIRECT' | 'SERVICES';
export type CategoryKind = 'CLINIC' | 'SERVICE_GROUP';

export interface CatalogCategoryLike {
  id: string;
  kind?: CategoryKind | null;
  bookingMode?: CategoryBookingMode | null;
  isActive?: boolean | null;
  archivedAt?: string | Date | null;
  sortOrder?: number | null;
}

export interface CatalogServiceLike {
  id: string;
  categoryId?: string | null;
  isHidden?: boolean | null;
  isActive?: boolean | null;
  archivedAt?: string | Date | null;
}

export interface CatalogEmployeeLike {
  isBookable?: boolean | null;
  serviceIds?: readonly string[] | null;
}

export interface BookableClinicEntry<C extends CatalogCategoryLike> {
  category: C;
  bookingMode: CategoryBookingMode;
  directServiceId: string | null;
  serviceIds: string[];
  therapistCount: number;
  serviceCount: number;
}

const isActive = (item: { isActive?: boolean | null; archivedAt?: string | Date | null }) =>
  item.isActive !== false && item.archivedAt == null;

/** Resolve the stored internal row for editing even when disabled. Public booking
 * still requires an active row in getCategoryBookingServices. No visible fallback.
 * See docs/architecture/clinic-service-booking-contract.md. */
export function getDirectClinicService<S extends CatalogServiceLike>(services: readonly S[]): S | undefined {
  const hidden = services.filter((service) => service.archivedAt == null && service.isHidden === true);
  return hidden.length === 1 ? hidden[0] : undefined;
}

export function getCategoryBookingServices<C extends CatalogCategoryLike, S extends CatalogServiceLike>(
  category: C,
  services: readonly S[],
): S[] {
  if (!isActive(category)) return [];
  const assigned = services.filter((service) => service.categoryId === category.id && isActive(service));
  if ((category.bookingMode ?? 'SERVICES') === 'DIRECT') {
    const direct = getDirectClinicService(assigned);
    return direct ? [direct] : [];
  }
  return assigned.filter((service) => service.isHidden !== true);
}

/** Legacy categories default to CLINIC/SERVICES; groups never enter the clinic directory.
 * See docs/architecture/clinic-service-booking-contract.md. */
export function selectBookableClinicEntries<C extends CatalogCategoryLike, S extends CatalogServiceLike>(
  catalog: { categories: readonly C[]; services: readonly S[] },
  employees: readonly CatalogEmployeeLike[],
): BookableClinicEntry<C>[] {
  return [...catalog.categories]
    .filter((category) => isActive(category) && (category.kind ?? 'CLINIC') === 'CLINIC')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .flatMap((category) => {
      const bookingMode = category.bookingMode ?? 'SERVICES';
      const bookingServices = getCategoryBookingServices(category, catalog.services);
      if (bookingServices.length === 0) return [];
      const serviceIds = bookingServices.map((service) => service.id);
      const serviceIdSet = new Set(serviceIds);
      const therapistCount = employees.filter((employee) =>
        employee.isBookable === true && employee.serviceIds?.some((id) => serviceIdSet.has(id)),
      ).length;
      if (therapistCount === 0) return [];
      return [{
        category,
        bookingMode,
        directServiceId: bookingMode === 'DIRECT' ? serviceIds[0] : null,
        serviceIds,
        therapistCount,
        serviceCount: bookingMode === 'DIRECT' ? 0 : serviceIds.length,
      }];
    });
}
