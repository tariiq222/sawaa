import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { employeeBookingsService } from '@/services/employee/bookings';
import type { Booking, BookingStatus } from '@/types/models';

export const employeeDayBookingsKeys = {
  all: ['employee', 'bookings', 'day'] as const,
  byDate: (date: string) => [...employeeDayBookingsKeys.all, date] as const,
};

const DEFAULT_STATUSES: BookingStatus[] = ['confirmed', 'pending'];

async function getAllBookingsForDay(status: BookingStatus, date: string) {
  const bookings: Booking[] = [];
  let page = 1;

  while (true) {
    const response = await employeeBookingsService.getAll({
      status,
      fromDate: date,
      toDate: date,
      page,
    });
    bookings.push(...(response.data?.items ?? []));
    if (!response.data?.meta.hasNextPage) return bookings;
    page += 1;
  }
}

export function useEmployeeDayBookings(date: string) {
  return useQuery<Booking[]>({
    queryKey: employeeDayBookingsKeys.byDate(date),
    queryFn: async () => {
      const bookings = await Promise.all(
        DEFAULT_STATUSES.map((status) => getAllBookingsForDay(status, date)),
      );
      return bookings
        .flat()
        .sort((a, b) => {
          const left = a.scheduledAt ?? `${a.date}T${a.startTime}:00+03:00`;
          const right = b.scheduledAt ?? `${b.date}T${b.startTime}:00+03:00`;
          return Date.parse(left) - Date.parse(right);
        });
    },
    enabled: !!date,
    placeholderData: keepPreviousData,
  });
}
