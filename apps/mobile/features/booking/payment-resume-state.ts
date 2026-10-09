import AsyncStorage from '@react-native-async-storage/async-storage';

import { clientBookingsService, type ClientBookingRow } from '@/services/client/bookings';
import type { DeliveryType } from '@/types/booking-enums';

const STORAGE_PREFIX = 'sawaa.booking-payment.pending:';
const INDEX_PREFIX = 'sawaa.booking-payment.index:';
const STORAGE_VERSION = 1;

export interface BookingPaymentDraft {
  branchId: string;
  employeeId: string;
  serviceId: string;
  scheduledAt: string;
  durationOptionId: string | null;
  deliveryType: DeliveryType | null;
}

export interface PendingBookingCheckout {
  bookingId: string;
  invoiceId: string | null;
  draft: BookingPaymentDraft | null;
}

export type PendingBookingCheckoutRead =
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'found'; checkout: PendingBookingCheckout };

interface StoredPendingBookingCheckout extends PendingBookingCheckout {
  version: number;
  userId: string;
}

type BookingResumeIdentity = Pick<PendingBookingCheckout, 'bookingId' | 'invoiceId'>;
export type BookingCheckoutUnavailableReason = 'BOOKING_EXPIRED' | 'BOOKING_CLOSED';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

function draftStorageKey(userId: string, draft: BookingPaymentDraft): string {
  return `${storageKey(userId)}:${encodeURIComponent(JSON.stringify(draft))}`;
}

function indexKey(userId: string): string {
  return `${INDEX_PREFIX}${encodeURIComponent(userId)}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalString(value: unknown): string | null {
  return value === null || value === undefined ? null : isNonEmptyString(value) ? value : '';
}

function normalizeDraft(value: unknown): BookingPaymentDraft | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<BookingPaymentDraft>;
  if (!isNonEmptyString(candidate.branchId)
    || !isNonEmptyString(candidate.employeeId)
    || !isNonEmptyString(candidate.serviceId)
    || !isNonEmptyString(candidate.scheduledAt)) {
    return null;
  }
  const durationOptionId = optionalString(candidate.durationOptionId);
  const deliveryType = optionalString(candidate.deliveryType);
  if (durationOptionId === '' || (deliveryType !== null && deliveryType !== 'in_person' && deliveryType !== 'online')) {
    return null;
  }
  return {
    branchId: candidate.branchId,
    employeeId: candidate.employeeId,
    serviceId: candidate.serviceId,
    scheduledAt: candidate.scheduledAt,
    durationOptionId,
    deliveryType: deliveryType as DeliveryType | null,
  };
}

function sameDraft(left: BookingPaymentDraft, right: BookingPaymentDraft): boolean {
  return left.branchId === right.branchId
    && left.employeeId === right.employeeId
    && left.serviceId === right.serviceId
    && left.scheduledAt === right.scheduledAt
    && left.durationOptionId === right.durationOptionId
    && left.deliveryType === right.deliveryType;
}

function parseStored(value: string, userId: string): PendingBookingCheckout | 'invalid' | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return 'invalid';
    const candidate = parsed as Partial<StoredPendingBookingCheckout>;
    const draft = normalizeDraft(candidate.draft);
    if (candidate.version !== STORAGE_VERSION
      || candidate.userId !== userId
      || !isNonEmptyString(candidate.bookingId)
      || (candidate.invoiceId !== null && !isNonEmptyString(candidate.invoiceId))
      || !draft) {
      return 'invalid';
    }
    return {
      bookingId: candidate.bookingId,
      invoiceId: candidate.invoiceId,
      draft,
    };
  } catch {
    return 'invalid';
  }
}

export function bookingPaymentDraft(input: {
  branchId?: string;
  employeeId?: string;
  serviceId?: string;
  scheduledAt?: string;
  durationOptionId?: string;
  deliveryType?: DeliveryType;
}): BookingPaymentDraft | null {
  return normalizeDraft({
    branchId: input.branchId,
    employeeId: input.employeeId,
    serviceId: input.serviceId,
    scheduledAt: input.scheduledAt,
    durationOptionId: input.durationOptionId ?? null,
    deliveryType: input.deliveryType ?? null,
  });
}

export async function savePendingBookingCheckout(
  userId: string,
  draft: BookingPaymentDraft,
  identity: BookingResumeIdentity,
): Promise<void> {
  if (!isNonEmptyString(userId) || !isNonEmptyString(identity.bookingId)
    || (identity.invoiceId !== null && !isNonEmptyString(identity.invoiceId))) {
    throw new Error('Invalid booking payment resume identity');
  }
  const key = draftStorageKey(userId, draft);
  await AsyncStorage.setItem(key, JSON.stringify({
    version: STORAGE_VERSION,
    userId,
    draft,
    bookingId: identity.bookingId,
    invoiceId: identity.invoiceId,
  } satisfies StoredPendingBookingCheckout));
  const indexRaw = await AsyncStorage.getItem(indexKey(userId));
  const index = indexRaw ? JSON.parse(indexRaw) as unknown : [];
  if (!Array.isArray(index) || index.some((item) => !isNonEmptyString(item))) {
    throw new Error('Invalid booking payment resume index');
  }
  await AsyncStorage.setItem(indexKey(userId), JSON.stringify(Array.from(new Set([...index, key]))));
}

export async function getPendingBookingCheckout(
  userId: string,
  draft: BookingPaymentDraft | null,
  routeIdentity?: Partial<BookingResumeIdentity>,
): Promise<PendingBookingCheckoutRead> {
  if (!isNonEmptyString(userId)) return { kind: 'invalid' };
  let keys: string[];
  try {
    if (draft) {
      keys = [draftStorageKey(userId, draft)];
    } else {
      const indexRaw = await AsyncStorage.getItem(indexKey(userId));
      const index = indexRaw ? JSON.parse(indexRaw) as unknown : [];
      if (!Array.isArray(index) || index.some((item) => !isNonEmptyString(item))) return { kind: 'invalid' };
      keys = index as string[];
    }
  } catch {
    return { kind: 'invalid' };
  }
  for (const key of keys) {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(key);
    } catch {
      return { kind: 'invalid' };
    }
    if (raw === null) continue;
    const parsed = parseStored(raw, userId);
    if (parsed === 'invalid') return { kind: 'invalid' };
    if (parsed === null || (draft && (!parsed.draft || !sameDraft(parsed.draft, draft)))) continue;
    if (routeIdentity?.bookingId !== undefined && routeIdentity.bookingId !== parsed.bookingId) continue;
    if (routeIdentity?.invoiceId !== undefined && routeIdentity.invoiceId !== parsed.invoiceId) continue;
    return { kind: 'found', checkout: parsed };
  }
  return { kind: 'missing' };
}

export async function clearPendingBookingCheckout(userId: string, draft?: BookingPaymentDraft): Promise<void> {
  if (!isNonEmptyString(userId)) return;
  if (!draft) {
    await AsyncStorage.removeItem(indexKey(userId));
    return;
  }
  const key = draftStorageKey(userId, draft);
  await AsyncStorage.removeItem(key);
  const indexRaw = await AsyncStorage.getItem(indexKey(userId));
  if (!indexRaw) return;
  const index = JSON.parse(indexRaw) as unknown;
  if (Array.isArray(index)) {
    await AsyncStorage.setItem(indexKey(userId), JSON.stringify(index.filter((item) => item !== key)));
  }
}

/**
 * The service mapper exposes AWAITING_PAYMENT as `pending`. A booking with an
 * invoice may resume while pending or deposit-confirmed with a balance due.
 * Identity and draft checks remain required before any payment attempt.
 */
export function isPendingBookingResumable(
  booking: Pick<ClientBookingRow, 'id' | 'invoiceId' | 'status' | 'branchId' | 'employeeId' | 'serviceId' | 'scheduledAt' | 'deliveryType'>,
  identity: BookingResumeIdentity,
  draft?: BookingPaymentDraft,
): boolean {
  if (booking.id !== identity.bookingId || booking.invoiceId !== identity.invoiceId) return false;
  if (identity.invoiceId === null) return false;
  if (!['pending', 'deposit_paid'].includes(booking.status)) return false;
  if (!draft) return true;
  const sameInstant = (left: string, right: string) => {
    const leftTime = Date.parse(left);
    const rightTime = Date.parse(right);
    return Number.isFinite(leftTime) && Number.isFinite(rightTime) ? leftTime === rightTime : left === right;
  };
  return (!booking.branchId || booking.branchId === draft.branchId)
    && (!booking.employeeId || booking.employeeId === draft.employeeId)
    && (!booking.serviceId || booking.serviceId === draft.serviceId)
    && (!booking.scheduledAt || sameInstant(booking.scheduledAt, draft.scheduledAt))
    && (!booking.deliveryType || !draft.deliveryType || booking.deliveryType.toLowerCase() === draft.deliveryType);
}

export function isInvoiceLessBookingComplete(
  booking: Pick<ClientBookingRow, 'id' | 'invoiceId' | 'status'>,
  identity: BookingResumeIdentity,
): boolean {
  return booking.id === identity.bookingId
    && booking.invoiceId === null
    && identity.invoiceId === null
    && ['confirmed', 'completed', 'deposit_paid'].includes(booking.status);
}

export async function resolvePendingBookingResume(
  userId: string,
  draft: BookingPaymentDraft | null,
  routeIdentity?: Partial<BookingResumeIdentity>,
): Promise<{ kind: 'missing' } | { kind: 'invalid'; unavailableReason?: BookingCheckoutUnavailableReason } | { kind: 'ready' | 'complete'; checkout: PendingBookingCheckout; booking: ClientBookingRow }> {
  if (!isNonEmptyString(userId)) return { kind: 'invalid' };
  // An explicitly bound checkout is verified with authenticated GET. Local storage is only
  // discovery for a draft without an identity; losing it must not create a second booking.
  const stored: PendingBookingCheckoutRead = routeIdentity?.bookingId
    ? { kind: 'missing' }
    : await getPendingBookingCheckout(userId, draft);
  if (stored.kind === 'invalid') return stored;
  if (stored.kind === 'missing' && !routeIdentity?.bookingId) return stored;
  const booking = await clientBookingsService.getById(stored.kind === 'found' ? stored.checkout.bookingId : routeIdentity!.bookingId!);
  if (booking.id !== (stored.kind === 'found' ? stored.checkout.bookingId : routeIdentity!.bookingId)
    || (routeIdentity?.invoiceId !== undefined && booking.invoiceId !== routeIdentity.invoiceId)) {
    return { kind: 'invalid' };
  }
  const checkout: PendingBookingCheckout = stored.kind === 'found'
    ? stored.checkout
    : { bookingId: booking.id, invoiceId: booking.invoiceId, draft };
  if (isInvoiceLessBookingComplete(booking, checkout)
    || (booking.id === checkout.bookingId && booking.invoiceId === checkout.invoiceId
      && ['confirmed', 'completed'].includes(booking.status))) {
    return { kind: 'complete', checkout, booking };
  }
  return isPendingBookingResumable(booking, checkout, checkout.draft ?? undefined)
    ? { kind: 'ready', checkout, booking }
    : { kind: 'invalid', ...(booking.status === 'expired' ? { unavailableReason: 'BOOKING_EXPIRED' as const }
      : booking.status === 'cancelled' || booking.status === 'no_show' ? { unavailableReason: 'BOOKING_CLOSED' as const } : {}) };
}
