import { getCategoryBookingServices, selectBookableClinicEntries } from '@sawaa/shared/catalog';
import type { PublicCatalogRaw, PublicService } from '@/services/client/catalog';

/** A scoped profile must never widen an invalid clinic/service link into all
 * practitioner services. See docs/architecture/clinic-service-booking-contract.md. */
export function getProfileBookingServices(
  catalog: PublicCatalogRaw,
  employeeServiceIds: readonly string[],
  clinicId?: string,
  serviceId?: string,
): PublicService[] {
  let services: PublicService[];
  if (clinicId) {
    const category = catalog.categories.find((item) => item.id === clinicId && item.isActive !== false && item.archivedAt == null && (item.kind ?? 'CLINIC') === 'CLINIC');
    if (!category) return [];
    services = getCategoryBookingServices(category, catalog.services);
  } else {
    services = catalog.categories
      .filter((category) => category.isActive !== false && category.archivedAt == null)
      .flatMap((category) => getCategoryBookingServices(category, catalog.services))
      .concat(catalog.services.filter((service) => service.categoryId == null && service.isHidden !== true && service.isActive !== false && service.archivedAt == null));
  }
  const employeeIds = new Set(employeeServiceIds);
  const allowed = services.filter((service) => employeeIds.has(service.id));
  if (serviceId) return allowed.filter((service) => service.id === serviceId);
  return allowed;
}

/** Group already-scoped choices by clinic; standalone services keep their identity.
 * Display assignments even when the practitioner is temporarily not bookable;
 * the profile CTA independently enforces the practitioner's booking status. */
export function getProfileBookingGroups(
  catalog: PublicCatalogRaw,
  services: readonly PublicService[],
) {
  const allowedIds = new Set(services.map((service) => service.id));
  const clinics = selectBookableClinicEntries(catalog, [
    { serviceIds: [...allowedIds], isBookable: true },
  ]).map((entry) => ({
    ...entry,
    services: services.filter((service) => entry.serviceIds.includes(service.id)),
  }));
  const clinicServiceIds = new Set(clinics.flatMap((clinic) => clinic.services.map((service) => service.id)));
  const standaloneServices = services.filter((service) => !clinicServiceIds.has(service.id));
  const serviceGroups = [...new Set(standaloneServices.map((service) => service.categoryId))].map((categoryId) => ({
    category: catalog.categories.find((category) => category.id === categoryId),
    services: standaloneServices.filter((service) => service.categoryId === categoryId),
  }));
  return { clinics, serviceGroups };
}
