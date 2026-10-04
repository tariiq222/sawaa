import { useMutation, useQueryClient } from '@tanstack/react-query';

import { employeeBookingsService } from '@/services/employee/bookings';
import { employeeBookingKeys } from './useEmployeeBookings';

function useEmployeeBookingAction(mutationFn: (id: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeeBookingKeys.all }),
    onError: () => undefined,
  });
}

export function useMarkEmployeeBookingCompleted() {
  return useEmployeeBookingAction(async (id) => employeeBookingsService.markCompleted(id));
}

export function useStartEmployeeBookingSession() {
  return useEmployeeBookingAction(async (id) => employeeBookingsService.startSession(id));
}

export function useRequestCancelEmployeeBooking() {
  return useEmployeeBookingAction(async (id) => employeeBookingsService.requestCancellation(id, ''));
}

export function useCancelEmployeeBooking() {
  return useEmployeeBookingAction(async (id) => employeeBookingsService.employeeCancel(id));
}
