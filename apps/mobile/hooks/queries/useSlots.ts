import { useQuery } from '@tanstack/react-query';

import { publicEmployeesService } from '@/services/client';

import { therapistKeys } from './useTherapists';

interface SlotsParams {
  employeeId?: string;
  branchId?: string;
  date?: string;
  durationMins?: number;
  serviceId?: string;
  durationOptionId?: string;
  bookingType?: string;
}

type SlotsResponse = Array<{ startTime: string; endTime: string }>;

export function useSlots(params: SlotsParams) {
  const enabled = Boolean(params.employeeId && params.branchId && params.date);
  return useQuery<SlotsResponse>({
    queryKey: therapistKeys.slots(params as Record<string, unknown>),
    queryFn: () =>
      publicEmployeesService.getSlots({
        employeeId: params.employeeId as string,
        branchId: params.branchId as string,
        date: params.date as string,
        durationMins: params.durationMins,
        serviceId: params.serviceId,
        durationOptionId: params.durationOptionId,
        bookingType: params.bookingType,
      }),
    enabled,
  });
}
