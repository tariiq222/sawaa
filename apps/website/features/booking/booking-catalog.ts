type BookingService = {
  categoryId?: string | null;
  isHidden?: boolean;
  nameAr: string;
  nameEn?: string | null;
};

type BookingCategory = {
  id: string;
  bookingMode?: 'DIRECT' | 'SERVICES';
  nameAr: string;
  nameEn?: string | null;
};

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
