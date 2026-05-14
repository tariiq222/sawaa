import { api } from "@/lib/api"
import type {
  ZohoConnectResponse,
  ZohoDataCenter,
  ZohoIntegrationStatus,
  ZohoPaymentMirrorsResponse,
  ZohoSelectOrgInput,
  ZohoTestResponse,
  ZohoUpdateConfigInput,
} from "@/lib/types/zoho-invoice"

const BASE = "/dashboard/integrations/zoho"

export async function fetchZohoStatus(): Promise<ZohoIntegrationStatus> {
  return api.get<ZohoIntegrationStatus>(BASE)
}

export async function startZohoConnect(dc: ZohoDataCenter): Promise<ZohoConnectResponse> {
  return api.get<ZohoConnectResponse>(`${BASE}/connect`, { dc })
}

export async function selectZohoOrganization(input: ZohoSelectOrgInput): Promise<{ ok: true; organizationName: string }> {
  return api.post<{ ok: true; organizationName: string }>(`${BASE}/select-organization`, input)
}

export async function disconnectZoho(): Promise<{ disconnected: true }> {
  return api.delete<{ disconnected: true }>(BASE)
}

export async function updateZohoConfig(input: ZohoUpdateConfigInput): Promise<{ ok: true }> {
  return api.put<{ ok: true }>(`${BASE}/config`, input)
}

export async function testZohoConfig(): Promise<ZohoTestResponse> {
  return api.post<ZohoTestResponse>(`${BASE}/test`, {})
}

export async function fetchZohoPaymentMirrors(params: {
  page?: number
  perPage?: number
  clientId?: string
}): Promise<ZohoPaymentMirrorsResponse> {
  return api.get<ZohoPaymentMirrorsResponse>(`${BASE}/payments-mirror`, params)
}

export async function sendZohoInvoice(zohoInvoiceId: string): Promise<{ ok: true }> {
  return api.post<{ ok: true }>(`${BASE}/invoices/${zohoInvoiceId}/send`)
}
