import { useQuery } from '@tanstack/react-query';

import {
  employeeBookingsService,
  getEmployeeBusinessDateToday,
} from '@/services/employee/bookings';
import type { EmployeeMeetingStart } from '@/services/employee/bookings';
import type { Booking } from '@/types/models';

export const employeeBookingKeys = {
  all: ['employee', 'bookings'] as const,
  detail: (id: string | undefined) => [...employeeBookingKeys.all, 'detail', id ?? '__none__'] as const,
  meetingStart: (id: string | undefined) => [...employeeBookingKeys.all, 'meeting-start', id ?? '__none__'] as const,
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

/**
 * Host link and exact timing for an assigned online booking. Always refetched:
 * the link only exists once the meeting has been created, and it must not be
 * kept around longer than the screen needs it.
 */
export function useEmployeeMeetingStart(id: string | undefined, enabled: boolean) {
  return useQuery<EmployeeMeetingStart>({
    queryKey: employeeBookingKeys.meetingStart(id),
    queryFn: () => {
      if (!id) throw new Error('Booking id is required');
      return employeeBookingsService.getMeetingStart(id);
    },
    enabled: Boolean(id) && enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
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
