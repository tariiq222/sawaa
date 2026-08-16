import type { PublicEmployee } from '@sawaa/api-client';

import { findDepartment } from './find-department';
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

const DELIVERY_TYPES: PublicDeliveryType[] = ['IN_PERSON', 'ONLINE'];

export function selectBookableClinicServices(
  catalog: PublicCatalog,
  employees: BookableEmployee[],
): BookableService[] {
  const clinicsDepartment = findDepartment(catalog.departments, {
    ar: ['عيادات'],
    en: ['clinic'],
  });
  if (!clinicsDepartment) return [];

  const categories = new Map(
    catalog.categories
      .filter(
        (category) =>
          category.isActive !== false && category.departmentId === clinicsDepartment.id,
      )
      .map((category) => [category.id, category]),
  );
  const bookableEmployees = employees.filter((employee) => employee.isBookable === true);

  return catalog.services.flatMap((service) => {
    const category = service.categoryId ? categories.get(service.categoryId) : undefined;
    if (!category) return [];

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
