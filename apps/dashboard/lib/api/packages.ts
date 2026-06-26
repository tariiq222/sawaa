/**
 * Session Packages API — Sawaa Dashboard
 *
 * App-local thin client for the new `/dashboard/organization/packages`
 * endpoints (Phase 1 of the session-packages rebuild). Mirrors the
 * pre-rebuild conventions (paginated list, single-detail, create /
 * update / soft-archive) and reuses the dashboard's `api` instance, so
 * cookie-bearing refresh + envelope-unwrap are inherited for free.
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  CreateSessionPackagePayload,
  PackageListQuery,
  SessionPackage,
  UpdateSessionPackagePayload,
} from "@/lib/types/package"

export async function fetchPackages(
  query: PackageListQuery = {},
): Promise<PaginatedResponse<SessionPackage>> {
  return api.get<PaginatedResponse<SessionPackage>>(
    "/dashboard/organization/packages",
    {
      page: query.page,
      limit: query.perPage,
      search: query.search,
      isActive: query.isActive,
      isPublic: query.isPublic,
    },
  )
}

export async function fetchPackage(id: string): Promise<SessionPackage> {
  return api.get<SessionPackage>(`/dashboard/organization/packages/${id}`)
}

export async function createPackage(
  payload: CreateSessionPackagePayload,
): Promise<SessionPackage> {
  return api.post<SessionPackage>(
    "/dashboard/organization/packages",
    payload,
  )
}

export async function updatePackage(
  id: string,
  payload: UpdateSessionPackagePayload,
): Promise<SessionPackage> {
  return api.patch<SessionPackage>(
    `/dashboard/organization/packages/${id}`,
    payload,
  )
}

export async function deletePackage(id: string): Promise<void> {
  await api.delete(`/dashboard/organization/packages/${id}`)
}

/**
 * Uploads an image and attaches its presigned URL to the package.
 * Mirrors `uploadServiceImage`: media upload → presigned URL → PATCH imageUrl.
 */
export async function uploadPackageImage(packageId: string, file: File): Promise<SessionPackage> {
  const formData = new FormData()
  formData.append("file", file)

  const uploaded = await api.postForm<{ id: string; storageKey: string }>(
    "/dashboard/media/upload",
    formData,
  )
  const presignedData = await api.get<{ url: string }>(
    `/dashboard/media/${uploaded.id}/presigned-url`,
    { expirySeconds: 900 },
  )
  return api.patch<SessionPackage>(`/dashboard/organization/packages/${packageId}`, {
    imageUrl: presignedData.url,
  })
}
