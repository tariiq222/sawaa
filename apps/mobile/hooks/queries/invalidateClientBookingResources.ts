import type { QueryClient } from '@tanstack/react-query';

/** Server-confirmed booking/payment changes affect every client overview. */
export function invalidateClientBookingResources(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    ['bookings'],
    ['portal'],
    ['packages'],
    ['programs'],
    ['client-payments', 'invoice'],
    ['therapists', 'slots'],
    ['therapists', 'available-days'],
  ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))).then(() => undefined);
}
