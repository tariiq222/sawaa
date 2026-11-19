import type { ReactNode } from 'react';
import type { Service } from '@sawaa/shared';
import { LocaleProvider } from '@/features/locale/locale-provider';

// Mirrors the extended shape ServicePicker used to read off each service
// (bookingConfigs / durationOptions are not on the base Service type).
// Kept here purely for fixture setup; the picker no longer consumes these.
export type ServiceWithConfigs = Service & {
  durationMins?: number;
  bookingConfigs?: Array<{
    id: string;
    deliveryType: 'IN_PERSON' | 'ONLINE';
    price: number | string;
    durationMins: number;
  }>;
  durationOptions?: Array<{
    id: string;
    deliveryType: 'IN_PERSON' | 'ONLINE';
    label: string;
    labelAr: string | null;
    durationMins: number;
    price: number | string;
  }>;
};

export function makeService(overrides: Partial<ServiceWithConfigs> = {}): ServiceWithConfigs {
  return {
    id: 'svc1',
    nameAr: 'جلسة استشارية',
    nameEn: 'Consultation',
    descriptionAr: null,
    descriptionEn: null,
    categoryId: 'cat1',
    price: 10000, // 100 SAR in halalas
    duration: 60,
    isActive: true,
    isHidden: false,
    hidePriceOnBooking: false,
    hideDurationOnBooking: false,
    bufferMinutes: 0,
    depositEnabled: false,
    depositPercent: null,
    maxParticipants: 1,
    minLeadMinutes: null,
    maxAdvanceDays: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export const CATEGORIES = [
  { id: 'cat1', nameAr: 'استشارة', nameEn: 'CatConsult' },
  { id: 'cat2', nameAr: 'علاج', nameEn: 'CatTherapy' },
];

export function withLocale(children: ReactNode) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}
