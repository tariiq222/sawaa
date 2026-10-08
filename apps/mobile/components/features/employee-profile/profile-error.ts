import axios from 'axios';
export function profileError(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  const data = error.response?.data as { code?: string } | undefined;
  if (error.response?.status === 429) return 'employeeSelfProfile.rateLimited';
  if (data?.code === 'CONTACT_ALREADY_IN_USE') return 'employeeSelfProfile.contactInUse';
  if (data?.code === 'INVALID_CONTACT_CODE') return 'employeeSelfProfile.invalidCode';
  if (data?.code === 'delivery_unavailable') return 'employeeSelfProfile.deliveryError';
  return fallback;
}
