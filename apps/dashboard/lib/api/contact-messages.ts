import { openApi } from "@/lib/api/openapi"
import type { PaginatedResponse } from "@/lib/types/common"

export type ContactMessageStatus = "NEW" | "READ" | "REPLIED" | "ARCHIVED"

export interface ContactMessage {
  id: string
  name: string
  phone: string | null
  email: string | null
  subject: string | null
  body: string
  status: ContactMessageStatus
  createdAt: string
  readAt: string | null
  archivedAt: string | null
}

export interface ContactMessageListQuery {
  page?: number
  limit?: number
  status?: ContactMessageStatus
}

export async function fetchContactMessages(
  query: ContactMessageListQuery = {},
): Promise<PaginatedResponse<ContactMessage>> {
  return openApi.get("/api/v1/dashboard/comms/contact-messages", {
    query: {
      page: query.page,
      limit: query.limit,
      status: query.status,
    },
  })
}

export async function updateContactMessageStatus(
  id: string,
  status: ContactMessageStatus,
): Promise<ContactMessage> {
  return openApi.patch("/api/v1/dashboard/comms/contact-messages/{id}/status", {
    path: { id },
    body: { status },
  })
}
