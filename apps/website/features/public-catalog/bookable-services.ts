import type { PublicEmployee } from '@sawaa/api-client';
import { getCategoryBookingServices, selectBookableClinicEntries } from '@sawaa/shared/catalog';

import type {
  PublicCatalog,
  PublicDeliveryType,
  PublicService,
} from './types';

type BookableEmployee = Pick<PublicEmployee, 'id' | 'isBookable' | 'serviceIds'>;

export interface BookableService {
  service: PublicService;
  categoryId: string;
  categoryNameAr: string;
  categoryNameEn: string | null;
  categoryImageUrl: string | null;
  categoryIconName: string | null;
  categoryIconBgColor: string | null;
  practitionerCount: number;
  deliveryTypes: PublicDeliveryType[];
}

export interface BookableClinic {
  id: string;
  nameAr: string;
  nameEn: string | null;
  /** Falls back to the linked booking service description — ServiceCategory has no
   * description column. Kept null when the service has none (audit C1). */
  descriptionAr: string | null;
  descriptionEn: string | null;
  imageUrl: string | null;
  iconName: string | null;
  iconBgColor: string | null;
  bookingMode: 'DIRECT' | 'SERVICES';
  directServiceId: string | null;
  therapistCount: number;
  serviceCount: number;
}

export function selectBookableClinics(
  catalog: PublicCatalog,
  employees: BookableEmployee[],
): BookableClinic[] {
  const servicesById = new Map(catalog.services.map((service) => [service.id, service]));
  return selectBookableClinicEntries(catalog, employees).map(
    ({ category, bookingMode, directServiceId, serviceIds, therapistCount, serviceCount }) => {
      // Prefer the direct internal service (DIRECT) or the first visible booking
      // service (SERVICES) as the source of the clinic card description.
      const descriptionSourceId = directServiceId ?? serviceIds[0] ?? null;
      const descriptionSource = descriptionSourceId ? servicesById.get(descriptionSourceId) : undefined;
      return {
        id: category.id,
        nameAr: category.nameAr,
        nameEn: category.nameEn,
        descriptionAr: descriptionSource?.descriptionAr ?? null,
        descriptionEn: descriptionSource?.descriptionEn ?? null,
        imageUrl: category.imageUrl,
        iconName: category.iconName,
        iconBgColor: category.iconBgColor,
        bookingMode,
        directServiceId,
        therapistCount,
        serviceCount,
      };
    },
  );
}

const DELIVERY_TYPES: PublicDeliveryType[] = ['IN_PERSON', 'ONLINE'];

export function selectBookableClinicServices(
  catalog: PublicCatalog,
  employees: BookableEmployee[],
): BookableService[] {
  const categories = new Map(
    catalog.categories
      .filter((category) => category.isActive !== false && category.archivedAt == null && category.bookingMode !== 'DIRECT')
      .map((category) => [category.id, category]),
  );
  const bookableEmployees = employees.filter((employee) => employee.isBookable === true);

  return catalog.services.flatMap((service) => {
    const category = service.categoryId ? categories.get(service.categoryId) : undefined;
    if (!category || !getCategoryBookingServices(category, [service]).length) return [];

    const practitioners = bookableEmployees.filter((employee) =>
      (employee.serviceIds ?? []).includes(service.id),
    );
    if (practitioners.length === 0) return [];

    const configuredTypes = new Set(
      (service.bookingConfigs ?? []).map((config) => config.deliveryType),
    );
    const deliveryTypes = DELIVERY_TYPES.filter((type) => configuredTypes.has(type));

    return [
      {
        service,
        categoryId: category.id,
        categoryNameAr: category.nameAr,
        categoryNameEn: category.nameEn,
        categoryImageUrl: category.imageUrl,
        categoryIconName: category.iconName,
        categoryIconBgColor: category.iconBgColor,
        practitionerCount: new Set(practitioners.map((employee) => employee.id)).size,
        deliveryTypes,
      },
    ];
  });
}
