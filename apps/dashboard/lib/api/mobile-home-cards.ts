import { api } from "@/lib/api"
import type {
  AdminMobileHomeCard,
  CreateMobileHomeCardPayload,
  MobileHomeCardOrderItem,
  UpdateMobileHomeCardPayload,
} from "@/lib/types/mobile-home-cards"

const CARDS_PATH = "/dashboard/mobile-home-cards"

export function fetchMobileHomeCards(): Promise<AdminMobileHomeCard[]> {
  return api.get<AdminMobileHomeCard[]>(CARDS_PATH)
}

export function createMobileHomeCard(
  payload: CreateMobileHomeCardPayload,
): Promise<AdminMobileHomeCard> {
  return api.post<AdminMobileHomeCard>(CARDS_PATH, payload)
}

export function updateMobileHomeCard(
  id: string,
  payload: UpdateMobileHomeCardPayload,
): Promise<AdminMobileHomeCard> {
  return api.patch<AdminMobileHomeCard>(`${CARDS_PATH}/${id}`, payload)
}

export function reorderMobileHomeCards(
  items: MobileHomeCardOrderItem[],
): Promise<AdminMobileHomeCard[]> {
  return api.put<AdminMobileHomeCard[]>(`${CARDS_PATH}/reorder`, { items })
}

export async function uploadMobileHomeCardImage(file: File): Promise<{ id: string }> {
  const form = new FormData()
  form.append("file", file)
  form.append("visibility", "PUBLIC")
  return api.postForm<{ id: string }>("/dashboard/media/upload", form)
}
