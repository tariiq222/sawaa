/**
 * Discount Reasons API — Sawaa Dashboard
 * Controller: dashboard/discount-reasons
 */

import {
  openApi,
  type OpenApiRequestBody,
} from "@/lib/api/openapi"
import type {
  CreateDiscountReasonInput,
  DiscountReason,
  UpdateDiscountReasonInput,
} from "@/lib/types/discount-reason"

type DiscountReasonsPath = "/api/v1/dashboard/discount-reasons"
type DiscountReasonPath = "/api/v1/dashboard/discount-reasons/{id}"
type CreateDiscountReasonBody = OpenApiRequestBody<DiscountReasonsPath, "post">
type UpdateDiscountReasonBody = OpenApiRequestBody<DiscountReasonPath, "patch">

export async function fetchDiscountReasons(
  includeInactive = false,
): Promise<DiscountReason[]> {
  return openApi.get("/api/v1/dashboard/discount-reasons", {
    query: { includeInactive: includeInactive ? true : undefined },
  })
}

export async function createDiscountReason(
  payload: CreateDiscountReasonInput,
): Promise<DiscountReason> {
  const body = payload satisfies CreateDiscountReasonBody
  return openApi.post("/api/v1/dashboard/discount-reasons", { body })
}

export async function updateDiscountReason(
  id: string,
  payload: UpdateDiscountReasonInput,
): Promise<DiscountReason> {
  const body = payload satisfies UpdateDiscountReasonBody
  return openApi.patch("/api/v1/dashboard/discount-reasons/{id}", {
    path: { id },
    body,
  })
}

export async function deleteDiscountReason(id: string): Promise<{ id: string }> {
  await openApi.delete("/api/v1/dashboard/discount-reasons/{id}", {
    path: { id },
  })
  return { id }
}
