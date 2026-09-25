import type { PublicService } from '@/services/client/catalog';

export interface PractitionerBookingEmployee {
  id: string;
  serviceIds: string[];
  isBookable: boolean;
}

export function getBookableServices(
  employee: PractitionerBookingEmployee | null | undefined,
  catalogServices: PublicService[],
): PublicService[] {
  if (!employee?.isBookable) return [];
  const catalogById = new Map(catalogServices.map((service) => [service.id, service]));
  return employee.serviceIds
    .map((serviceId) => catalogById.get(serviceId))
    .filter((service): service is PublicService => service !== undefined);
}

export function practitionerBookingRoute(employeeId: string, serviceId: string) {
  return {
    pathname: '/(client)/booking/[serviceId]' as const,
    params: { serviceId, employeeId },
  };
}
