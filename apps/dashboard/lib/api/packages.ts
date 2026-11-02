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
      limit: query.limit,
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

/** Stable storage key returned by the media upload endpoint. */
export interface PackageMediaUpload {
  id: string
  storageKey: string
}

/**
 * Step 1 of the package image flow: upload the file and return its stable
 * storage key. The upload is intentionally separate from the package write —
 * the callers (both package forms) write the package first, then attach the
 * key, so a failed upload never loses the rest of the form.
 */
export async function uploadPackageMedia(file: File): Promise<PackageMediaUpload> {
  const formData = new FormData()
  formData.append("file", file)
  return api.postForm<PackageMediaUpload>("/dashboard/media/upload", formData)
}

/** Step 2: persist the storage key on the package (image-only PATCH). */
export async function attachPackageImage(
  packageId: string,
  storageKey: string,
): Promise<SessionPackage> {
  return api.patch<SessionPackage>(
    `/dashboard/organization/packages/${packageId}`,
    { imageUrl: storageKey },
  )
}

/**
 * Best-effort removal of an uploaded media record that never got attached to a
 * package (attach PATCH failed). Deletion is by media id — the media endpoints
 * are id-based. Callers must swallow its rejection: cleanup can never replace
 * the attach error the user needs to see.
 */
export async function deletePackageMedia(mediaId: string): Promise<void> {
  await api.delete(`/dashboard/media/${mediaId}`)
}

/**
 * Uploads an image and attaches its stable storage key to the package.
 * Package readers mint a fresh signed URL whenever the entity is read.
 */
export async function uploadPackageImage(
  packageId: string,
  file: File,
): Promise<SessionPackage> {
  const uploaded = await uploadPackageMedia(file)
  return attachPackageImage(packageId, uploaded.storageKey)
}
