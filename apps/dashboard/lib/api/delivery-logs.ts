import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/api"

export interface DeliveryLogItem {
  id: string
  organizationId: string
  recipientId: string
  type: string
  priority: string
  channel: string
  status: string
  senderActor: string
  toAddress: string | null
  providerName: string | null
  attempts: number
  lastAttemptAt: string | null
  sentAt: string | null
  errorMessage: string | null
  createdAt: string
}

export interface DeliveryLogsFilters {
  status?: string
  channel?: string
  page?: number
  perPage?: number
}

export interface EmailFallbackQuota {
  used: number
  limit: number
  periodStart: string
}

export async function fetchDeliveryLogs(
  filters: DeliveryLogsFilters = {},
): Promise<PaginatedResponse<DeliveryLogItem>> {
  const params = new URLSearchParams()
  if (filters.status) params.set("status", filters.status)
  if (filters.channel) params.set("channel", filters.channel)
  params.set("page", String(filters.page ?? 1))
  params.set("perPage", String(filters.perPage ?? 20))
  return api.get<PaginatedResponse<DeliveryLogItem>>(
    `/dashboard/comms/delivery-logs?${params.toString()}`,
  )
}

export async function fetchEmailFallbackQuota(): Promise<EmailFallbackQuota> {
  return api.get<EmailFallbackQuota>("/dashboard/comms/email-fallback-quota")
}
