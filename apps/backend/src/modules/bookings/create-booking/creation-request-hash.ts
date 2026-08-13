import { createHash } from 'node:crypto';

export interface BookingCreationIdentity {
  branchId: string;
  clientId: string;
  employeeId: string;
  serviceId: string;
  scheduledAt: Date | string;
  endsAt: Date | string;
  durationMins: number;
  durationOptionId: string | null;
  bookingType: string;
  deliveryType: string;
  price: number | string;
  currency: string;
  source: string;
  expiresAt?: Date | string | null;
  payAtClinic?: boolean;
  couponCode?: string | null;
  notes?: string | null;
}

/** Hashes the complete normalized immutable creation command. */
export function bookingCreationRequestHash(input: BookingCreationIdentity): string {
  const iso = (value: Date | string): string => new Date(value).toISOString();
  const normalized = {
    branchId: input.branchId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    serviceId: input.serviceId,
    scheduledAt: iso(input.scheduledAt),
    endsAt: iso(input.endsAt),
    durationMins: input.durationMins,
    durationOptionId: input.durationOptionId,
    bookingType: input.bookingType,
    deliveryType: input.deliveryType,
    price: Number(input.price).toString(),
    currency: input.currency,
    source: input.source,
    expiresAt: input.expiresAt ? iso(input.expiresAt) : null,
    payAtClinic: input.payAtClinic ?? false,
    couponCode: input.couponCode ?? null,
    notes: input.notes ?? null,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
