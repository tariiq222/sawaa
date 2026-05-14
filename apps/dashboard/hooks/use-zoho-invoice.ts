"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  disconnectZoho,
  fetchZohoPaymentMirrors,
  fetchZohoStatus,
  selectZohoOrganization,
  sendZohoInvoice,
  startZohoConnect,
  testZohoConfig,
  updateZohoConfig,
} from "@/lib/api/zoho-invoice"
import type {
  ZohoDataCenter,
  ZohoIntegrationStatus,
  ZohoPaymentMirrorsResponse,
  ZohoTestResponse,
  ZohoUpdateConfigInput,
} from "@/lib/types/zoho-invoice"

const ZOHO_STATUS_KEY = ["zoho-invoice", "status"] as const
const ZOHO_PAYMENT_MIRRORS_KEY = ["zoho-invoice", "payments-mirror"] as const

export function useZohoStatus() {
  return useQuery<ZohoIntegrationStatus>({
    queryKey: ZOHO_STATUS_KEY,
    queryFn: fetchZohoStatus,
    staleTime: 30 * 1000,
  })
}

export function useStartZohoConnect() {
  return useMutation({
    mutationFn: (dc: ZohoDataCenter) => startZohoConnect(dc),
  })
}

export function useSelectZohoOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (zohoOrganizationId: string) =>
      selectZohoOrganization({ zohoOrganizationId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ZOHO_STATUS_KEY })
    },
  })
}

export function useDisconnectZoho() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: disconnectZoho,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ZOHO_STATUS_KEY })
    },
  })
}

export function useUpdateZohoConfig() {
  const qc = useQueryClient()
  return useMutation<{ ok: true }, Error, ZohoUpdateConfigInput>({
    mutationFn: updateZohoConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ZOHO_STATUS_KEY })
    },
  })
}

export function useTestZohoConfig() {
  return useMutation<ZohoTestResponse, Error, void>({
    mutationFn: testZohoConfig,
  })
}

export function useZohoPaymentMirrors(params: {
  page?: number
  perPage?: number
  clientId?: string
}) {
  return useQuery<ZohoPaymentMirrorsResponse>({
    queryKey: [...ZOHO_PAYMENT_MIRRORS_KEY, params.page ?? 1, params.perPage ?? 25, params.clientId ?? ""],
    queryFn: () => fetchZohoPaymentMirrors(params),
    placeholderData: (prev) => prev,
  })
}

export function useSendZohoInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (zohoInvoiceId: string) => sendZohoInvoice(zohoInvoiceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ZOHO_PAYMENT_MIRRORS_KEY })
    },
  })
}
