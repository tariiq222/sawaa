/**
 * Discount Reasons API — Sawaa Dashboard
 * Controller: dashboard/discount-reasons
 */

import { api } from "@/lib/api"
import type {
  CreateDiscountReasonInput,
  DiscountReason,
  UpdateDiscountReasonInput,
} from "@/lib/types/discount-reason"

export async function fetchDiscountReasons(
  includeInactive = false,
): Promise<DiscountReason[]> {
  return api.get<DiscountReason[]>("/dashboard/discount-reasons", {
    includeInactive: includeInactive ? true : undefined,
  })
}

export async function createDiscountReason(
  payload: CreateDiscountReasonInput,
): Promise<DiscountReason> {
  return api.post<DiscountReason>("/dashboard/discount-reasons", payload)
}

export async function updateDiscountReason(
  id: string,
  payload: UpdateDiscountReasonInput,
): Promise<DiscountReason> {
  return api.patch<DiscountReason>(`/dashboard/discount-reasons/${id}`, payload)
}

export async function deleteDiscountReason(id: string): Promise<{ id: string }> {
  return api.delete<{ id: string }>(`/dashboard/discount-reasons/${id}`)
}
