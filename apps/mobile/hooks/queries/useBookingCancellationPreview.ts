import { useQuery } from '@tanstack/react-query';
import { clientBookingsService } from '@/services/client/bookings';

export function useBookingCancellationPreview(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['bookings', 'cancellation-preview', id],
    queryFn: () => clientBookingsService.cancellationPreview(id),
    enabled,
    retry: false,
    staleTime: 0,
  });
}
