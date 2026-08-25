// W4-T13 — extracted from booking-pos.tsx on 2026-08-25. Owns the
// wizard's selection chain (client → department → category →
// service → employee → type → duration) plus the W3-T11
// DIRECT-category credit guard. Pure move — handler bodies,
// comments, and the W3-T11 `useCallback` dependency array are
// unchanged.

"use client"

import { useCallback } from "react"
import { toast } from "sonner"
import type { QueryClient } from "@tanstack/react-query"

import { fetchServices } from "@/lib/api/services"
import { queryKeys } from "@/lib/query-keys"
import { isServiceAllowed } from "@/lib/booking-credit-filter"

import type {
  BookingFormState,
  CategoryBookingMode,
} from "./use-booking-form-state"
import type { EmployeeServiceType } from "@/lib/types/employee"
import type { Locale } from "@/lib/translations"
import type { SectionId } from "./pos-collapsible-section"

interface UseBookingPosSelectionHandlersParams {
  state: BookingFormState
  setOpenSection: (id: SectionId) => void
  setUseCredit: (v: boolean) => void
  setCreditDismissed: (v: boolean) => void
  queryClient: QueryClient
  locale: Locale
  t: (key: string) => string
  serviceTypes: EmployeeServiceType[]
  resolvePreservedDurationOptionId: (
    currentId: string | null,
    serviceType: EmployeeServiceType | undefined,
    defaultId: string | null,
  ) => string | null
  selectClient: (id: string, name: string) => void
  selectDepartment: (id: string, name: string) => void
  selectService: (id: string, name: string) => void
  selectEmployee: (id: string, name: string) => void
  selectDeliveryType: (deliveryType: "IN_PERSON" | "ONLINE") => void
  selectDurationOption: (durationOptionId: string | null) => void
  selectCategory: (
    categoryId: string,
    categoryName: string,
    bookingMode: CategoryBookingMode | null,
    autoService?: { serviceId: string; serviceName: string },
  ) => void
}

export function useBookingPosSelectionHandlers(
  params: UseBookingPosSelectionHandlersParams,
) {
  const {
    state, setOpenSection, setUseCredit, setCreditDismissed,
    queryClient, locale, t, serviceTypes, resolvePreservedDurationOptionId,
    selectClient, selectDepartment, selectService, selectEmployee,
    selectDeliveryType, selectDurationOption, selectCategory,
  } = params

  // Phase 3 — re-arm the credit badge whenever the operator changes
  // any of the four matching-credit params.
  const handleClientSelect = (id: string, name: string) => {
    selectClient(id, name)
    // Open the right section based on the currently-selected track.
    // On a fresh booking track is null → land on the track step so the
    // operator immediately sees the three booking-path cards.
    setOpenSection(
      state.track === "PACKAGES"
        ? "package"
        : state.track === "GROUP"
        ? "program"
        : state.track === "CLINICS"
        ? "department"
        : "track",
    )
    setUseCredit(false)
    setCreditDismissed(false)
  }
  const handleDepartmentSelect = (id: string, name: string) => {
    selectDepartment(id, name)
    setOpenSection("category")
  }
  const handleServiceSelect = (id: string, name: string) => {
    selectService(id, name)
    setOpenSection("employee")
    // PACKAGES-track sessions must NEVER charge the client twice: keep the
    // credit-mode flag on so submit hits /from-credit, not /bookings.
    // The credit badge is a CLINICS-only auto-detect affordance and can be
    // dismissed freely when we're committed to a package credit.
    if (!state.packagePurchaseId) setUseCredit(false)
    setCreditDismissed(false)
  }
  const handleEmployeeSelect = (id: string, name: string) => {
    selectEmployee(id, name)
    setOpenSection("typeDuration")
    // PACKAGES-track sessions must NEVER charge the client twice: keep the
    // credit-mode flag on so submit hits /from-credit, not /bookings.
    // The credit badge is a CLINICS-only auto-detect affordance and can be
    // dismissed freely when we're committed to a package credit.
    if (!state.packagePurchaseId) setUseCredit(false)
    setCreditDismissed(false)
  }

  const handleSelectDeliveryType = (
    deliveryType: string,
    durationOptionId: string | null,
  ) => {
    selectDeliveryType(deliveryType.toUpperCase() as "IN_PERSON" | "ONLINE")
    // Preserve an existing credit-driven durationOptionId when it is still
    // valid for the chosen delivery type.
    const normalizedType = deliveryType.toUpperCase()
    const matchingServiceType = serviceTypes.find(
      (st) => st.deliveryType.toUpperCase() === normalizedType && st.isActive,
    )
    const resolvedId = resolvePreservedDurationOptionId(
      state.durationOptionId,
      matchingServiceType,
      durationOptionId,
    )
    selectDurationOption(resolvedId)
    const matchHasMultiple = (matchingServiceType?.durationOptions?.length ?? 0) > 1
    setOpenSection(matchHasMultiple ? "typeDuration" : "datetime")
    // PACKAGES-track sessions must NEVER charge the client twice: keep the
    // credit-mode flag on so submit hits /from-credit, not /bookings.
    // The credit badge is a CLINICS-only auto-detect affordance and can be
    // dismissed freely when we're committed to a package credit.
    if (!state.packagePurchaseId) setUseCredit(false)
    setCreditDismissed(false)
  }

  const handleSelectDuration = (durationOptionId: string) => {
    selectDurationOption(durationOptionId)
    setOpenSection("datetime")
    if (!state.packagePurchaseId) setUseCredit(false)
    setCreditDismissed(false)
  }

  /**
   * When a category (clinic) is selected, branch on `category.bookingMode`:
   *   - DIRECT   → hidden service auto-selected, skip to employee step.
   *   - SERVICES → user always picks a service, even for single-service
   *                categories.
   *   - null     → behave like SERVICES (legacy clinics).
   * If a DIRECT category has no hidden service in the cache (data drift),
   * fall back to the service step rather than blocking the wizard.
   *
   * W3-T11 — under an active FLEXIBLE-credit filter, the hidden service
   * must ALSO pass `isServiceAllowed`. If the credit forbids it, do not
   * auto-select (the wizard would otherwise skip the service step and
   * trip `creditMatchesTarget` server-side). Surface the existing
   * `filter.noOptions` key via toast and leave the wizard on the
   * category step so the operator can pick a different category.
   */
  const handleCategorySelect = useCallback(async (
    id: string,
    name: string,
    bookingMode: "DIRECT" | "SERVICES" | null,
  ) => {
    const filters = { categoryId: id, isActive: true, limit: 100, includeHidden: true }
    const qKey = queryKeys.services.list(filters)
    const cached = queryClient.getQueryData<Awaited<ReturnType<typeof fetchServices>>>(qKey)
    const data = cached ?? await queryClient.fetchQuery({
      queryKey: qKey,
      queryFn: () => fetchServices(filters),
      staleTime: 5 * 60 * 1000,
    })

    if (bookingMode === "DIRECT") {
      const hidden = (data?.items ?? []).find((s) => s.isHidden)
      if (hidden) {
        if (state.creditFilter && !isServiceAllowed(state.creditFilter, hidden.id)) {
          // DIRECT category's hidden service is FORBIDDEN by the active
          // FLEXIBLE credit. Do NOT auto-select — leave the wizard on
          // the category step so the operator picks a different
          // category. Reuse the existing `filter.noOptions` copy: it is
          // the closest existing translation for "this credit has no
          // services that match what you just picked".
          toast.error(t("bookings.pos.package.filter.noOptions"))
          return
        }
        const svcName = locale === "ar" ? hidden.nameAr : (hidden.nameEn ?? hidden.nameAr)
        selectCategory(id, name, "DIRECT", { serviceId: hidden.id, serviceName: svcName })
        setOpenSection("employee")
        return
      }
    }
    selectCategory(id, name, bookingMode)
    setOpenSection("service")
  }, [queryClient, selectCategory, locale, setOpenSection, state.creditFilter, t])

  return {
    handleClientSelect,
    handleDepartmentSelect,
    handleServiceSelect,
    handleEmployeeSelect,
    handleSelectDeliveryType,
    handleSelectDuration,
    handleCategorySelect,
  }
}