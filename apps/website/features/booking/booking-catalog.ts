type BookingService = {
  id?: string;
  categoryId?: string | null;
  isHidden?: boolean;
  isActive?: boolean;
  archivedAt?: string | null;
  nameAr: string;
  nameEn?: string | null;
};

type BookingCategory = {
  id: string;
  bookingMode?: 'DIRECT' | 'SERVICES';
  kind?: 'CLINIC' | 'SERVICE_GROUP';
  nameAr: string;
  nameEn?: string | null;
};

/** Direct clinics retain their internal booking ID and are presented by clinic
 * name. A practitioner entry further limits the choices to their services. */
export function selectAvailableBookingServices<T extends BookingService & { id: string }>(
  services: T[],
  categories: BookingCategory[],
  bookableServiceIds: ReadonlySet<string>,
  lockedEmployeeServiceIds?: readonly string[],
): T[] {
  const directClinicIds = new Set(categories.filter((category) =>
    category.bookingMode === 'DIRECT' && (category.kind ?? 'CLINIC') === 'CLINIC',
  ).map((category) => category.id));
  const locked = lockedEmployeeServiceIds ? new Set(lockedEmployeeServiceIds) : null;
  return services.filter((service) =>
    service.isActive !== false && service.archivedAt == null &&
    bookableServiceIds.has(service.id) &&
    (!locked || locked.has(service.id)) &&
    (service.isHidden !== true || (!!service.categoryId && directClinicIds.has(service.categoryId))),
  );
}

export function presentDirectClinicServices<T extends BookingService>(
  services: T[],
  categories: BookingCategory[],
): T[] {
  const directClinics = new Map(categories.filter((category) => category.bookingMode === 'DIRECT').map((category) => [category.id, category]));
  return services.map((service) => {
    const clinic = service.isHidden && service.categoryId ? directClinics.get(service.categoryId) : null;
    return clinic ? { ...service, nameAr: clinic.nameAr, nameEn: clinic.nameEn ?? clinic.nameAr } : service;
  });
}
