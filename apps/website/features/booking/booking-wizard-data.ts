'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WizardStep } from '@sawaa/shared';
import type { AvailableSlot, EmployeeWithUser, Service, WizardState } from '@sawaa/shared';
import { publicFetch } from '@/lib/public-fetch';
import {
  getPublicAvailability,
  getPublicAvailabilityDays,
  getPublicBranches,
} from '@/features/booking/booking.api';
import { presentDirectClinicServices } from '@/features/booking/booking-catalog';
import { usePaymentMethods } from '@/features/payment/use-payment-methods';
import type { UiState } from '@/features/booking/booking-wizard-state';

/**
 * All network reads for the booking wizard live here. Nothing in this module
 * dispatches state: it only turns query results into data + loading/error
 * flags, which the composition hook feeds into the pure derivations.
 */

type CatalogCategory = {
  id: string;
  nameAr: string;
  nameEn: string;
  bookingMode?: 'DIRECT' | 'SERVICES';
};
type CatalogShape = {
  services: (Service & { isHidden?: boolean })[];
  categories: CatalogCategory[];
  vatRate?: number;
};

export function useBookingCatalogData() {
  const { data: employees = [], isLoading: loadingEmployees, error: employeesError } = useQuery({
    queryKey: ['public', 'employees'],
    queryFn: async () => {
      const json = await publicFetch<{ data?: EmployeeWithUser[] } | EmployeeWithUser[]>('/public/employees?includeDirectClinics=true');
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });

  const { data: catalog = { services: [], categories: [], vatRate: 0 }, isLoading: loadingServices, error: servicesError } = useQuery({
    queryKey: ['public', 'catalog'],
    queryFn: async () => {
      const json = await publicFetch<{ data?: CatalogShape } | CatalogShape>('/public/services?includeDirectClinics=true');
      const payload = 'data' in json && json.data ? json.data : (json as CatalogShape);
      return {
        services: presentDirectClinicServices(payload.services ?? [], payload.categories ?? []),
        categories: payload.categories ?? [],
        // Tolerate older cached responses that predate the vatRate field.
        vatRate: payload.vatRate ?? 0,
      };
    },
  });

  const { data: branches = [], isLoading: loadingBranches, error: branchesError } = useQuery({
    queryKey: ['public', 'branches'],
    queryFn: getPublicBranches,
  });

  // Deliberately NOT part of `loadingData`: a free booking needs no payment
  // method, so a failed lookup must only stop the paid path (the info step owns
  // that decision) instead of the whole wizard.
  const { data: paymentMethods, isLoading: paymentMethodsLoading } = usePaymentMethods();

  const services = catalog.services;
  const categories = catalog.categories;
  // Fractional org VAT rate (a fraction of 1, 0 when VAT is off) — display-only: the backend computes
  // the real invoice; we just show gross amounts so the customer isn't surprised.
  const vatRate = catalog.vatRate ?? 0;
  const loadingData = loadingEmployees || loadingServices || loadingBranches;
  const initialLoadError = employeesError ?? servicesError ?? branchesError;

  return {
    employees,
    services,
    categories,
    branches,
    vatRate,
    loadingData,
    initialLoadError,
    paymentMethods,
    paymentMethodsLoading,
  };
}

export function useBookingAvailability(input: {
  state: WizardState;
  employeeId: string | undefined;
  serviceId: string | undefined;
  branchId: string | undefined;
  selectedDate: string;
  selectedChoice: UiState['selectedChoice'];
}) {
  const { state, employeeId, serviceId, branchId, selectedDate, selectedChoice } = input;
  const enabled = state.step === WizardStep.SLOT && !!employeeId && !!branchId;

  const { data: slots = [], isLoading: loadingSlots, error: slotsError } = useQuery({
    queryKey: [
      'public',
      'availability',
      employeeId,
      selectedDate,
      serviceId,
      branchId,
      selectedChoice?.durationOptionId,
      selectedChoice?.deliveryType,
    ],
    queryFn: () =>
      getPublicAvailability(employeeId!, selectedDate, serviceId, branchId, {
        durationOptionId: selectedChoice?.durationOptionId,
        deliveryType: selectedChoice?.deliveryType,
      }),
    enabled,
  });

  // Per-day "has any slot?" probe drives the date-strip greying. Anchored to
  // today and renewed when employee/service/branch change.
  const { data: availabilityDays = [], error: availabilityDaysError } = useQuery({
    queryKey: [
      'public',
      'availability',
      'days',
      employeeId,
      serviceId,
      branchId,
      selectedChoice?.durationOptionId,
      selectedChoice?.deliveryType,
    ],
    queryFn: () =>
      getPublicAvailabilityDays(employeeId!, {
        serviceId,
        branchId,
        days: 14,
        // Probe with the SAME duration/delivery context as the slot fetch so
        // the strip greys exactly the days the later query can book.
        durationOptionId: selectedChoice?.durationOptionId,
        deliveryType: selectedChoice?.deliveryType,
      }),
    enabled,
  });

  const bookableDates = useMemo(
    () => new Set(availabilityDays.filter((d) => d.hasSlots).map((d) => d.date)),
    [availabilityDays],
  );

  return {
    slots: slots as AvailableSlot[],
    loadingSlots,
    slotsError,
    availabilityDays,
    availabilityDaysError,
    bookableDates,
  };
}
