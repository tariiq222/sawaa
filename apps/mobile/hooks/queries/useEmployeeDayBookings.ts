import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { employeeBookingsService } from '@/services/employee/bookings';
import type { Booking, BookingStatus } from '@/types/models';

export const employeeDayBookingsKeys = {
  all: ['employee', 'bookings', 'day'] as const,
  byDate: (date: string) => [...employeeDayBookingsKeys.all, date] as const,
};

const DEFAULT_STATUSES: BookingStatus[] = ['confirmed', 'pending'];

export function useEmployeeDayBookings(date: string) {
  return useQuery<Booking[]>({
    queryKey: employeeDayBookingsKeys.byDate(date),
    queryFn: async () => {
      const res = await employeeBookingsService.getAll({
        status: DEFAULT_STATUSES,
        date,
      });
      return res.data?.items ?? [];
    },
    enabled: !!date,
    placeholderData: keepPreviousData,
  });
}
