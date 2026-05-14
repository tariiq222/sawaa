"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  fetchOrganizationHours,
  updateOrganizationHours,
  fetchOrganizationHolidays,
  createOrganizationHoliday,
  deleteOrganizationHoliday,
} from "@/lib/api/organization"
import {
  fetchBookingSettings,
  updateBookingSettings,
} from "@/lib/api/booking-settings"
import {
  fetchBookingFlowOrder,
  updateBookingFlowOrder,
  fetchPaymentSettings,
  updatePaymentSettings,
  type BookingFlowOrder,
} from "@/lib/api/organization-settings"
import { fetchOrganizationSettings, updateOrganizationSettings } from "@/lib/api/organization-settings"
import type { UpdateOrganizationSettingsPayload } from "@/lib/types/organization-settings"
import { queryKeys } from "@/lib/query-keys"

/* ─── Query Keys ─── */

const BOOKING_SETTINGS_KEY = ["booking-settings"] as const

/* ─── Clinic Working Hours ─── */

export function useOrganizationHours(branchId: string | null) {
  return useQuery({
    queryKey: queryKeys.organization.hours(branchId ?? ""),
    queryFn: () => fetchOrganizationHours(branchId!),
    enabled: !!branchId,
    staleTime: 30 * 60 * 1000, // 30 min — hours rarely change
  })
}

export function useOrganizationHoursMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ branchId, hours }: {
      branchId: string
      hours: Parameters<typeof updateOrganizationHours>[1]
    }) => updateOrganizationHours(branchId, hours),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organization.hours(variables.branchId) })
    },
  })
}

/* ─── Clinic Holidays ─── */

export function useOrganizationHolidays(branchId: string | null, year?: number) {
  return useQuery({
    queryKey: queryKeys.organization.holidays(branchId ?? "", year),
    queryFn: () => fetchOrganizationHolidays(branchId!, year),
    enabled: !!branchId,
    staleTime: 30 * 60 * 1000, // 30 min — holidays are planned in advance
  })
}

export function useCreateHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ branchId, ...data }: {
      branchId: string
      date: string
      nameAr: string
      nameEn: string
    }) => createOrganizationHoliday(branchId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organization.holidays(variables.branchId) })
    },
  })
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteOrganizationHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organization.all })
    },
  })
}

/* ─── Booking Settings ─── */

export function useBookingSettings() {
  return useQuery({
    queryKey: BOOKING_SETTINGS_KEY,
    queryFn: fetchBookingSettings,
    staleTime: 30 * 60 * 1000, // 30 min — booking config rarely changes
  })
}

export function useBookingSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateBookingSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookingSettings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationPublic.settings() })
    },
  })
}

/* ─── Booking Flow Order ─── */

export function useBookingFlowOrder() {
  return useQuery({
    queryKey: queryKeys.organizationSettings.bookingFlowOrder(),
    queryFn: fetchBookingFlowOrder,
    staleTime: 5 * 60 * 1000,
  })
}

export function useBookingFlowOrderMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (order: BookingFlowOrder) => updateBookingFlowOrder(order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationSettings.bookingFlowOrder() })
    },
  })
}

/* ─── Payment Settings ─── */

export function usePaymentSettings() {
  return useQuery({
    queryKey: queryKeys.organizationSettings.payment(),
    queryFn: fetchPaymentSettings,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePaymentSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updatePaymentSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationSettings.payment() })
    },
  })
}


/* ─── Clinic Settings Config ─── */

export function useOrganizationSettings() {
  return useQuery({
    queryKey: queryKeys.organizationSettings.config(),
    queryFn: fetchOrganizationSettings,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateOrganizationSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateOrganizationSettingsPayload) => updateOrganizationSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationSettings.all })
    },
  })
}
