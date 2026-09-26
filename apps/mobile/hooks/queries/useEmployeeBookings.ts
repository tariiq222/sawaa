import { useQuery } from '@tanstack/react-query';

import {
  employeeBookingsService,
  getEmployeeBusinessDateToday,
} from '@/services/employee/bookings';
import type { Booking } from '@/types/models';

export const employeeBookingKeys = {
  all: ['employee', 'bookings'] as const,
  detail: (id: string | undefined) => [...employeeBookingKeys.all, 'detail', id ?? '__none__'] as const,
  today: (businessDate: string) => [...employeeBookingKeys.all, 'today', businessDate] as const,
};

export function useEmployeeBooking(id: string | undefined) {
  return useQuery<Booking>({
    queryKey: employeeBookingKeys.detail(id),
    queryFn: async () => {
      if (!id) throw new Error('Booking id is required');
      const response = await employeeBookingsService.getById(id);
      if (!response.data) throw new Error('Booking was not found');
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useEmployeeTodayBookings() {
  const businessDate = getEmployeeBusinessDateToday();
  return useQuery({
    queryKey: employeeBookingKeys.today(businessDate),
    queryFn: async () => {
      const response = await employeeBookingsService.getTodayBookings();
      if (!response.data) throw new Error('Today schedule was not returned');
      return response.data;
    },
    retry: false,
  });
}
