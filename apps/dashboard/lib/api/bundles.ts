/**
 * Bundles API — Sawaa Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  ServiceBundle,
  BundleListQuery,
  CreateBundlePayload,
  UpdateBundlePayload,
} from "@/lib/types/bundle"

/* ─── Bundles ─── */

export async function fetchBundles(
  query: BundleListQuery = {},
): Promise<PaginatedResponse<ServiceBundle>> {
  return api.get<PaginatedResponse<ServiceBundle>>("/dashboard/organization/bundles", {
    page: query.page,
    limit: query.perPage,
    search: query.search,
    isActive: query.isActive,
    includeHidden: query.includeHidden,
  })
}

export async function fetchBundle(id: string): Promise<ServiceBundle> {
  return api.get<ServiceBundle>(`/dashboard/organization/bundles/${id}`)
}

export async function createBundle(
  payload: CreateBundlePayload,
): Promise<ServiceBundle> {
  return api.post<ServiceBundle>("/dashboard/organization/bundles", payload)
}

export async function updateBundle(
  id: string,
  payload: UpdateBundlePayload,
): Promise<ServiceBundle> {
  return api.patch<ServiceBundle>(`/dashboard/organization/bundles/${id}`, payload)
}

export async function deleteBundle(id: string): Promise<void> {
  await api.delete(`/dashboard/organization/bundles/${id}`)
}
