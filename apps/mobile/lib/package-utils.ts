import type { ClientPackageCredit, PackagePurchaseStatus } from '@sawaa/shared/types';

export function isCreditBookable(credit: ClientPackageCredit): boolean {
  return credit.remaining > 0 && credit.serviceIsBookable && credit.availability?.bookable !== false;
}

export function creditLockReason(credit: ClientPackageCredit): 'depleted' | 'unavailable' | 'unsupported' | null {
  if (credit.remaining <= 0) return 'depleted';
  if (!credit.serviceIsBookable) return 'unsupported';
  if (credit.availability?.bookable === false) return 'unavailable';
  return null;
}

export function formatHalalas(value: number, locale: string): string {
  return `${(value / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

export type PackagePaymentState = 'pending' | 'success' | 'failed';

export function packagePaymentState(
  status: PackagePurchaseStatus | undefined,
  isLoading: boolean,
): PackagePaymentState {
  if (isLoading || status === 'PENDING') return 'pending';
  if (status === 'ACTIVE' || status === 'COMPLETED') return 'success';
  return 'failed';
}
