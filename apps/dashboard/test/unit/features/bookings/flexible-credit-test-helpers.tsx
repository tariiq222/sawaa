/**
 * flexible-credit-test-helpers.tsx — shared pure utilities for the
 * flexible-credit split spec files. No vi.mock declarations live here:
 * Vitest hoisting lifts mocks declared in the consuming spec to the
 * top of that file, so each spec owns its own mocked module surface.
 * The (a)-(k) coverage is split as follows:
 *
 *   flexible-credit-step-filters.spec.tsx     (a) (b) (c) (d) (e)
 *   flexible-credit-sections.spec.tsx         (f) (j) (k)
 *   flexible-credit-direct-category.spec.tsx  (g) (h) (i)
 *
 * Only factories that genuinely deduplicate across at least two specs
 * live here — locale stubs, shell-level mocks, and bespoke state
 * builders stay local to the spec that owns the assertions so each
 * file is independently understandable.
 */

import React from "react"
import { render } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  })
}

export function renderWithQueryClient(node: React.ReactNode) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      {node}
    </QueryClientProvider>,
  )
}

export const META = {
  total: 0,
  page: 1,
  limit: 100,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
}

export const SERVICE = (
  id: string,
  nameAr: string,
  nameEn: string | null = null,
  employeeCount = 1,
) => ({
  id,
  ref: Number(id.replace(/\D/g, "")) || 1,
  nameAr,
  nameEn,
  descriptionAr: null,
  descriptionEn: null,
  categoryId: "cat-1",
  price: 15000,
  currency: "SAR",
  durationMins: 60,
  isActive: true,
  isHidden: false,
  hidePriceOnBooking: false,
  hideDurationOnBooking: false,
  iconName: null,
  iconBgColor: null,
  imageUrl: null,
  bufferMinutes: 0,
  minLeadMinutes: null,
  maxAdvanceDays: null,
  depositEnabled: false,
  depositAmount: null,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  employeeCount,
})

export const PRACTITIONER = (id: string, nameAr: string) => ({
  id,
  ref: Number(id.replace(/\D/g, "")) || 1,
  userId: `user-${id}`,
  title: null,
  nameAr,
  specialty: "",
  specialtyAr: null,
  bio: null,
  bioAr: null,
  experience: null,
  education: null,
  educationAr: null,
  isActive: true,
  avatarUrl: null,
  slug: null,
  isPublic: false,
  publicBioAr: null,
  publicBioEn: null,
  publicImageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  user: {
    id: `user-${id}`,
    firstName: nameAr,
    lastName: "",
    email: "",
    phone: null,
  },
})

export const SERVICE_EMPLOYEE = (id: string, nameAr: string) => ({
  id: `es-${id}`,
  employee: {
    id,
    nameAr,
    title: null,
    avatarUrl: null,
    isActive: true,
    user: PRACTITIONER(id, nameAr).user,
  },
  serviceTypes: [
    {
      id: `st-${id}-inperson`,
      deliveryType: "IN_PERSON",
      price: 15000,
      duration: 60,
      durationMins: 60,
      useCustomOptions: false,
      isActive: true,
      durationOptions: [],
    },
  ],
  customDuration: 60,
  bufferMinutes: 0,
  availableTypes: ["IN_PERSON"],
  isActive: true,
  hasCustomPricing: false,
})