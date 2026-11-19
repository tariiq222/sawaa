'use client';

import { useMemo } from 'react';
import type { EmployeeWithUser, Service } from '@sawaa/shared';
import type { PublicBranch } from '@/features/booking/booking.api';
import {
  deriveBookableEmployees,
  deriveBookableServiceIds,
  deriveBranchScopedEmployees,
  deriveFilteredServices,
  deriveFilteredTherapists,
  deriveGlobalBookableServiceIds,
  deriveNothingBookable,
} from '@/features/booking/booking-wizard-derived';

/**
 * The catalogue pools the wizard narrows as the user chooses: employees that
 * are bookable, then branch-scoped, then service/therapist lists. Pure derived
 * data, memoised only to keep referential stability for the effects.
 */
export function useBookingWizardPools(input: {
  employees: EmployeeWithUser[];
  services: Service[];
  categories: Array<{ id: string; nameAr: string; bookingMode?: 'DIRECT' | 'SERVICES' }>;
  branches: PublicBranch[];
  selectedBranch: PublicBranch | null;
  lockedEmployee: EmployeeWithUser | null;
  service: Service | null;
  loadError: unknown;
  loadingData: boolean;
}) {
  // Cross-selection narrowing — backend now ships serviceIds + branchIds + isBookable
  // on each public employee, so we use them to keep both sides of the funnel honest.
  const bookableEmployees = useMemo(
    () => deriveBookableEmployees(input.employees),
    [input.employees],
  );
  // Once a branch is chosen (branch-first flow), restrict the pool of employees
  // to those who actually work at that branch. Services and therapist lists are
  // derived from this restricted pool.
  const branchScopedEmployees = useMemo(
    () => deriveBranchScopedEmployees(bookableEmployees, input.selectedBranch),
    [bookableEmployees, input.selectedBranch],
  );
  // Set of service ids that at least one bookable therapist actually delivers,
  // scoped to the chosen branch when applicable.
  const bookableServiceIds = useMemo(
    () => deriveBookableServiceIds(branchScopedEmployees),
    [branchScopedEmployees],
  );
  const filteredServices = useMemo(
    () => deriveFilteredServices(input.services, input.categories, bookableServiceIds, input.lockedEmployee),
    [input.services, input.categories, bookableServiceIds, input.lockedEmployee],
  );
  const filteredTherapists = useMemo(
    () => deriveFilteredTherapists(branchScopedEmployees, input.service),
    [branchScopedEmployees, input.service],
  );

  // Hard gate: if loading finished and there's literally nothing bookable
  // *anywhere* (any branch), show a contact-us screen. Don't trigger this just
  // because the user's currently-selected branch happens to have no offerings —
  // that case is handled with an in-flow message.
  const globalBookableServiceIds = useMemo(
    () => deriveGlobalBookableServiceIds(bookableEmployees),
    [bookableEmployees],
  );
  const nothingBookable = deriveNothingBookable({
    loadError: input.loadError,
    loadingData: input.loadingData,
    bookableEmployees,
    globalBookableServiceIds,
    branches: input.branches,
  });

  return {
    bookableEmployees,
    filteredServices,
    filteredTherapists,
    nothingBookable,
  };
}
