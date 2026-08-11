// whatsapp — WhatsApp AI agent API client (dashboard).

import { api } from "@/lib/api"
import type {
  StaffReplyInput,
  StaffReplyResult,
  UpsertWhatsappAgentConfigInput,
  UpsertWhatsappConfigInput,
  UpsertWhatsappConfigResult,
  WhatsappAgentConfigView,
  WhatsappConfigView,
  WhatsappControlInput,
  WhatsappControlResult,
  WhatsappConversationDetail,
  WhatsappConversationList,
  WhatsappQrView,
  WhatsappStatusView,
  TestWhatsappResult,
} from "@/lib/types/whatsapp"

// ── Integration config ──────────────────────────────────────────────────────

export async function fetchWhatsappConfig(): Promise<WhatsappConfigView> {
  return api.get<WhatsappConfigView>("/dashboard/integrations/whatsapp")
}

export async function upsertWhatsappConfig(
  input: UpsertWhatsappConfigInput,
): Promise<UpsertWhatsappConfigResult> {
  return api.put<UpsertWhatsappConfigResult>("/dashboard/integrations/whatsapp", input)
}

export async function testWhatsappConfig(): Promise<TestWhatsappResult> {
  return api.post<TestWhatsappResult>("/dashboard/integrations/whatsapp/test", {})
}

export async function resetWhatsappConfig(): Promise<{ reset: boolean }> {
  return api.delete<{ reset: boolean }>("/dashboard/integrations/whatsapp")
}

export async function unlinkWhatsappConfig(): Promise<{
  unlinked: boolean
  logoutOk: boolean
}> {
  return api.post<{ unlinked: boolean; logoutOk: boolean }>(
    "/dashboard/integrations/whatsapp/unlink",
    {},
  )
}

// ── AI agent config ─────────────────────────────────────────────────────────

export async function fetchWhatsappAgentConfig(): Promise<WhatsappAgentConfigView> {
  return api.get<WhatsappAgentConfigView>("/dashboard/whatsapp/agent-config")
}

export async function upsertWhatsappAgentConfig(
  input: UpsertWhatsappAgentConfigInput,
): Promise<WhatsappAgentConfigView> {
  return api.patch<WhatsappAgentConfigView>("/dashboard/whatsapp/agent-config", input)
}

// ── Runtime ────────────────────────────────────────────────────────────────

export async function fetchWhatsappStatus(): Promise<WhatsappStatusView> {
  return api.get<WhatsappStatusView>("/dashboard/whatsapp/status")
}

export async function controlWhatsapp(
  input: WhatsappControlInput,
): Promise<WhatsappControlResult> {
  return api.post<WhatsappControlResult>("/dashboard/whatsapp/control", input)
}

export async function fetchWhatsappQr(): Promise<WhatsappQrView> {
  return api.get<WhatsappQrView>("/dashboard/whatsapp/qr")
}

// ── Conversations ─────────────────────────────────────────────────────────

export interface ListWhatsappConversationsArgs {
  status?: string
  bookingFilter?: "BOOKED" | "NOT_BOOKED"
  search?: string
  unread?: boolean
  staffTakeover?: boolean
  deliveryFailure?: boolean
  from?: string
  to?: string
  staffUserId?: string
  sort?: "recent" | "oldest"
  page?: number
  pageSize?: number
}

export async function listWhatsappConversations(
  args: ListWhatsappConversationsArgs = {},
): Promise<WhatsappConversationList> {
  return api.get<WhatsappConversationList>("/dashboard/whatsapp/conversations", {
    status: args.status,
    bookingFilter: args.bookingFilter,
    search: args.search,
    unread: args.unread,
    staffTakeover: args.staffTakeover,
    deliveryFailure: args.deliveryFailure,
    from: args.from,
    to: args.to,
    staffUserId: args.staffUserId,
    sort: args.sort,
    page: args.page ?? 1,
    pageSize: args.pageSize ?? 20,
  })
}

export async function fetchWhatsappConversation(
  id: string,
): Promise<WhatsappConversationDetail> {
  return api.get<WhatsappConversationDetail>(`/dashboard/whatsapp/conversations/${id}`)
}

export async function staffReply(
  conversationId: string,
  input: StaffReplyInput,
): Promise<StaffReplyResult> {
  return api.post<StaffReplyResult>(
    `/dashboard/whatsapp/conversations/${conversationId}/reply`,
    input,
  )
}

export async function closeWhatsappConversation(
  id: string,
): Promise<{ closed: true }> {
  return api.post<{ closed: true }>(
    `/dashboard/whatsapp/conversations/${id}/close`,
  )
}

export async function markWhatsappConversationRead(
  id: string,
  throughMessageId?: string,
): Promise<{ conversationId: string; unreadCount: number }> {
  return api.post(`/dashboard/whatsapp/conversations/${id}/read`, {
    throughMessageId,
  })
}

export async function releaseWhatsappTakeover(
  id: string,
): Promise<{ released: true }> {
  return api.post(`/dashboard/whatsapp/conversations/${id}/release`)
}
