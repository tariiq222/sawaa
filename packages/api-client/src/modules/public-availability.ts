import { apiRequest } from '../client';
import { buildQueryString } from '../types/api';
import type { AvailableSlot } from '@deqah/shared';

export async function getPublicAvailability(
  employeeId: string,
  date: string,
  serviceId?: string,
): Promise<AvailableSlot[]> {
  const params: Record<string, string> = { date };
  if (serviceId) params['serviceId'] = serviceId;
  return apiRequest<AvailableSlot[]>(
    `/public/employees/${employeeId}/availability${buildQueryString(params)}`,
  );
}