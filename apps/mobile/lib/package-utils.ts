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

/**
 * - `pending`: still checking with the server (bounded polling in progress).
 * - `success`: the server reports the purchase ACTIVE/COMPLETED.
 * - `failed`: the gateway reported a decline/cancel, or the purchase can no
 *   longer activate.
 * - `unconfirmed`: polling ran out while the purchase is still PENDING and no
 *   success signal arrived. The client may check again or retry the payment.
 */
export type PackagePaymentState = 'pending' | 'success' | 'failed' | 'unconfirmed';

/** Poll interval while a purchase is PENDING. */
export const PACKAGE_PAYMENT_POLL_INTERVAL_MS = 3000;
/** Still-PENDING reads before giving up when the browser result is unknown (~30s). */
export const PACKAGE_PAYMENT_MAX_POLLS = 10;
/** Still-PENDING reads after the client closed the payment page (~15s). */
export const PACKAGE_PAYMENT_MAX_POLLS_AFTER_CLOSE = 5;

/** What the client-side checkout told us, independent of the server status. */
export type PackageCheckoutSignal = 'failed' | 'closed' | 'paid' | 'unknown';

const FAILED_GATEWAY_STATUSES = new Set(['failed', 'canceled', 'cancelled', 'expired', 'voided', 'declined']);
const PAID_GATEWAY_STATUSES = new Set(['paid', 'captured', 'completed']);

/**
 * Reads Moyasar's redirect query parameters (`status`, `message`) when they
 * reach the app. A paid status is only a hint: activation is still read from
 * the authenticated API.
 */
export function packageCheckoutSignalFromRedirect(status: string | undefined | null): PackageCheckoutSignal {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return 'unknown';
  if (FAILED_GATEWAY_STATUSES.has(normalized)) return 'failed';
  if (PAID_GATEWAY_STATUSES.has(normalized)) return 'paid';
  return 'unknown';
}

/**
 * Maps an expo-web-browser result type. Closing the page is NOT a failure on
 * its own — the client may have paid and then closed the page — so it only
 * shortens the polling window.
 */
export function packageCheckoutSignalFromBrowser(type: string | undefined | null): PackageCheckoutSignal {
  if (type === 'cancel' || type === 'dismiss') return 'closed';
  return 'unknown';
}

/** Parses `a=1&b=2` query strings without relying on the URL polyfill. */
export function parseQueryParams(url: string | undefined | null): Record<string, string> {
  if (!url) return {};
  const queryStart = url.indexOf('?');
  if (queryStart < 0) return {};
  const hashStart = url.indexOf('#', queryStart);
  const query = url.slice(queryStart + 1, hashStart < 0 ? undefined : hashStart);
  const result: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [rawKey, ...rest] = pair.split('=');
    try {
      result[decodeURIComponent(rawKey.replace(/\+/g, ' '))] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
    } catch {
      // Ignore malformed pairs.
    }
  }
  return result;
}

export function maxPackagePaymentPolls(signal: PackageCheckoutSignal): number {
  return signal === 'closed' ? PACKAGE_PAYMENT_MAX_POLLS_AFTER_CLOSE : PACKAGE_PAYMENT_MAX_POLLS;
}

export function packagePaymentState(
  status: PackagePurchaseStatus | undefined,
  isLoading: boolean,
  options: { signal?: PackageCheckoutSignal; pendingPolls?: number } = {},
): PackagePaymentState {
  // The server is authoritative for success, even after a gateway decline
  // (the client may have retried and paid on the same hosted page).
  if (status === 'ACTIVE' || status === 'COMPLETED') return 'success';
  const signal = options.signal ?? 'unknown';
  if (signal === 'failed' && status !== 'REFUNDED') return 'failed';
  if (isLoading) return 'pending';
  if (status === 'PENDING') {
    const polls = options.pendingPolls ?? 0;
    return polls >= maxPackagePaymentPolls(signal) ? 'unconfirmed' : 'pending';
  }
  return 'failed';
}

/** HTTP status + server message from an Axios-like error, if any. */
function errorDetails(error: unknown): { status?: number; message: string } {
  const response = (error as { response?: { status?: number; data?: { message?: unknown } } } | null)?.response;
  const raw = response?.data?.message;
  const message = Array.isArray(raw) ? raw.join(' ') : typeof raw === 'string' ? raw : '';
  return { status: response?.status, message };
}

/**
 * The stored attempt key belongs to a purchase that has since been paid. The
 * backend refuses to reuse it, so a new purchase needs a fresh key.
 */
export function isPaidAttemptKeyError(error: unknown): boolean {
  const { status, message } = errorDetails(error);
  return status === 400 && /already been paid/i.test(message);
}

/** i18n key for a failure to start package checkout. */
export function packagePurchaseErrorKey(error: unknown): string {
  const { status, message } = errorDetails(error);
  if (status === 409 && /already been paid/i.test(message)) return 'packages.purchaseAlreadyPaid';
  if (status === 409) return 'packages.purchaseConflict';
  return 'packages.purchaseError';
}
