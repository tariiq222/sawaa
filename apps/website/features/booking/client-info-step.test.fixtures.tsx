import type { ComponentProps, ReactNode } from 'react';
import type { Service, EmployeeWithUser, AvailableSlot } from '@sawaa/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientInfoStep } from './client-info-step';
import { LocaleProvider } from '@/features/locale/locale-provider';

export const fakeClient = {
  id: 'c1',
  name: 'Sara',
  email: 'sara@test.com',
  phone: '+966500000000',
  emailVerified: '2026-01-01T00:00:00.000Z',
  phoneVerified: null,
  accountType: 'REGISTERED' as const,
  claimedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const slot: AvailableSlot = {
  startTime: '2026-07-01T14:00:00.000Z',
  endTime: '2026-07-01T15:00:00.000Z',
};

export const service: Service = {
  id: 'svc1',
  nameAr: 'استشارة',
  nameEn: 'Consultation',
  descriptionAr: null,
  descriptionEn: null,
  categoryId: 'cat1',
  price: 10000,
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
};

export const employee: EmployeeWithUser = {
  id: 'emp1',
  userId: 'u1',
  specialty: null,
  specialtyAr: null,
  bio: null,
  bioAr: null,
  experience: 0,
  education: null,
  educationAr: null,
  rating: 0,
  reviewCount: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  nameAr: 'د. ليلى',
  nameEn: 'Dr. Layla',
  user: {
    id: 'u1',
    firstName: 'Layla',
    lastName: 'K.',
    email: 'l@sawa.test',
    phone: null,
    avatarUrl: null,
  },
};

export function withLocale(children: ReactNode, locale: 'ar' | 'en' = 'en', qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return (
    <QueryClientProvider client={qc}>
      <LocaleProvider locale={locale}>{children}</LocaleProvider>
    </QueryClientProvider>
  );
}

/** Both collection paths enabled — the behaviour these cases assert. */
export const ALL_PAYMENT_METHODS = { moyasarEnabled: true, atClinicEnabled: true };

/**
 * Renders the step with every payment method available (the historical
 * behaviour). The payment-gating cases render `ClientInfoStep` directly so they
 * control `paymentMethods` explicitly.
 */
export function Step({
  paymentMethods = ALL_PAYMENT_METHODS,
  paymentMethodsLoading = false,
  ...props
}: Omit<ComponentProps<typeof ClientInfoStep>, 'paymentMethods' | 'paymentMethodsLoading'> & {
  paymentMethods?: ComponentProps<typeof ClientInfoStep>['paymentMethods'];
  paymentMethodsLoading?: boolean;
}) {
  return (
    <ClientInfoStep
      {...props}
      paymentMethods={paymentMethods}
      paymentMethodsLoading={paymentMethodsLoading}
    />
  );
}
