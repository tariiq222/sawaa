import { useQuery } from '@tanstack/react-query';
import { getPractitionerBookingOptions } from '@/features/booking/booking-options';

export const bookingOptionKeys = {
  all: ['booking-options'] as const,
  detail: (serviceId?: string, employeeId?: string) => [...bookingOptionKeys.all, serviceId, employeeId] as const,
};

export function useBookingOptions(serviceId?: string, employeeId?: string) {
  return useQuery({
    meta: { silentError: true },
    queryKey: bookingOptionKeys.detail(serviceId, employeeId),
    queryFn: () => getPractitionerBookingOptions(serviceId!, employeeId!),
    enabled: Boolean(serviceId && employeeId),
  });
}
