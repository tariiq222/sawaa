import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { LegacyAppointmentStatus } from './legacy-import.types';

export type HistoricalBookingStatus =
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED';

export type HistoricalDeliveryType = 'IN_PERSON' | 'ONLINE';

const ONLINE_LEGACY_SERVICE_IDS = new Set([103, 141, 272, 273, 286]);

export function normalizeSaudiPhone(value: string | null | undefined): string | null {
  const input = value?.replace(/\p{Cf}/gu, '').trim();
  if (!input) return null;
  const prefixed = input.startsWith('966') ? `+${input}` : input;
  const parsed = parsePhoneNumberFromString(prefixed, 'SA');
  if (!parsed?.isValid() || parsed.country !== 'SA') return null;
  return parsed.number;
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

export function canonicalName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

export function sarToHalalas(value: string): number {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new Error(`invalid legacy SAR amount: ${value}`);
  const whole = BigInt(match[1]!);
  const fraction = (match[2] ?? '').padEnd(4, '0');
  if (/[^0]/.test(fraction.slice(2))) {
    throw new Error(`legacy SAR amount contains a sub-halalah fraction: ${value}`);
  }
  const halalas = whole * 100n + BigInt(fraction.slice(0, 2) || '0');
  const result = Number(halalas);
  if (!Number.isSafeInteger(result)) {
    throw new Error(`legacy SAR amount is outside the safe range: ${value}`);
  }
  return result;
}

export function epochSecondsToDate(value: number): Date {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`invalid epoch seconds: ${value}`);
  }
  return new Date(value * 1_000);
}

export function mapHistoricalStatus(
  status: LegacyAppointmentStatus,
): HistoricalBookingStatus {
  switch (status) {
    case 'approved':
      return 'CONFIRMED';
    case 'canceled':
    case 'rejected':
      return 'CANCELLED';
    case 'pending':
      return 'EXPIRED';
  }
}

export function mapDeliveryType(serviceId: number): HistoricalDeliveryType {
  return ONLINE_LEGACY_SERVICE_IDS.has(serviceId) ? 'ONLINE' : 'IN_PERSON';
}
