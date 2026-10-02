import { useCallback } from 'react';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';

import { getPractitionerBookingOptions, type PractitionerBookingOptions } from '@/features/booking/booking-options';

export interface ServicePriceFloor {
  price: number;
  currency: string;
}

/** Lowest practitioner price (halalas) for one service, keyed by employee id. Missing key = unknown. */
export function useServicePriceFloors(
  serviceId: string | undefined,
  employeeIds: string[],
): Record<string, ServicePriceFloor> {
  const combine = useCallback((results: UseQueryResult<PractitionerBookingOptions>[]) => {
    const floors: Record<string, ServicePriceFloor> = {};
    results.forEach((result, index) => {
      const options = result.data?.options ?? [];
      if (options.length === 0) return;
      const cheapest = options.reduce((best, option) => (option.price < best.price ? option : best));
      floors[employeeIds[index]] = { price: cheapest.price, currency: cheapest.currency };
    });
    return floors;
  }, [employeeIds]);

  return useQueries({
    queries: employeeIds.map((employeeId) => ({
      queryKey: ['booking-options', serviceId, employeeId] as const,
      queryFn: () => getPractitionerBookingOptions(serviceId as string, employeeId),
      enabled: Boolean(serviceId),
      // A failed price request just leaves that card without a price; no global alert.
      meta: { silentError: true },
    })),
    combine,
  });
}
