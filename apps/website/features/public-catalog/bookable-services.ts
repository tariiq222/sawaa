import type { PublicEmployee } from '@sawaa/api-client';

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
  const publicDepartmentIds = new Set(catalog.departments.map((department) => department.id));
  return catalog.categories
    .filter((category) =>
      category.isActive !== false &&
      (category.departmentId === null || publicDepartmentIds.has(category.departmentId)),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((category) => {
      const assignedServices = catalog.services.filter((service) => service.categoryId === category.id);
      const bookingMode = category.bookingMode ?? 'SERVICES';
      const bookingServices = assignedServices.filter((service) =>
        bookingMode === 'DIRECT' ? service.isHidden === true : !service.isHidden,
      );
      const serviceIds = new Set(bookingServices.map((service) => service.id));
      const therapistCount = employees.filter((employee) =>
        employee.isBookable === true && employee.serviceIds.some((id) => serviceIds.has(id)),
      ).length;
      if (therapistCount === 0) return [];
      const serviceCount = bookingMode === 'SERVICES' ? bookingServices.length : 0;
      const directServiceId = assignedServices.find((service) => service.isHidden)?.id ?? null;
      if (bookingMode === 'DIRECT' && !directServiceId) return [];
      if (bookingMode === 'SERVICES' && serviceCount === 0) return [];
      return [{
        id: category.id,
        nameAr: category.nameAr,
        nameEn: category.nameEn,
        imageUrl: category.imageUrl,
        iconName: category.iconName,
        iconBgColor: category.iconBgColor,
        bookingMode,
        directServiceId: bookingMode === 'DIRECT' ? directServiceId : null,
        therapistCount,
        serviceCount,
      }];
    });
}

const DELIVERY_TYPES: PublicDeliveryType[] = ['IN_PERSON', 'ONLINE'];

export function selectBookableClinicServices(
  catalog: PublicCatalog,
  employees: BookableEmployee[],
): BookableService[] {
  const publicDepartmentIds = new Set(catalog.departments.map((department) => department.id));
  const categories = new Map(
    catalog.categories
      .filter(
        (category) =>
          category.isActive !== false &&
          (category.departmentId === null || publicDepartmentIds.has(category.departmentId)),
      )
      .map((category) => [category.id, category]),
  );
  const bookableEmployees = employees.filter((employee) => employee.isBookable === true);

  return catalog.services.flatMap((service) => {
    const category = service.categoryId ? categories.get(service.categoryId) : undefined;
    if (!category || service.isHidden) return [];

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
