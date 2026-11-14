/**
 * Session Packages API — Sawaa Dashboard
 *
 * Thin client for `/dashboard/organization/packages`. Response types come from
 * the committed OpenAPI snapshot through `@/lib/api/openapi`, so a backend
 * response change is a type error here instead of a silent drift:
 *
 *  - GET list returns decorated rows with the price flattened onto the row;
 *  - GET detail returns the decorated package with a nested `price` breakdown;
 *  - POST and PATCH return the RAW persisted row (legacy `items`, or grouped
 *    `groups`) and carry no computed price — the forms use them for the id only
 *    and refresh the catalog afterwards.
 */

import { api } from "@/lib/api"
import { openApi } from "@/lib/api/openapi"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  CreateSessionPackagePayload,
  PackageListQuery,
  PackageWriteResponse,
  SessionPackage,
  SessionPackageDetail,
  UpdateSessionPackagePayload,
} from "@/lib/types/package"

export async function fetchPackages(
  query: PackageListQuery = {},
): Promise<PaginatedResponse<SessionPackage>> {
  return openApi.get("/api/v1/dashboard/organization/packages", {
    query: {
      page: query.page,
      limit: query.limit,
      search: query.search,
      isActive: query.isActive,
      isPublic: query.isPublic,
    },
  })
}

export async function fetchPackage(id: string): Promise<SessionPackageDetail> {
  return openApi.get("/api/v1/dashboard/organization/packages/{packageId}", {
    path: { packageId: id },
  })
}

export async function createPackage(
  payload: CreateSessionPackagePayload,
): Promise<PackageWriteResponse> {
  return api.post<PackageWriteResponse>(
    "/dashboard/organization/packages",
    payload,
  )
}

export async function updatePackage(
  id: string,
  payload: UpdateSessionPackagePayload,
): Promise<PackageWriteResponse> {
  return api.patch<PackageWriteResponse>(
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

/**
 * Step 2: persist the storage key on the package (image-only PATCH). The
 * response is the raw persisted row; callers only await success.
 */
export async function attachPackageImage(
  packageId: string,
  storageKey: string,
): Promise<PackageWriteResponse> {
  return api.patch<PackageWriteResponse>(
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
): Promise<PackageWriteResponse> {
  const uploaded = await uploadPackageMedia(file)
  return attachPackageImage(packageId, uploaded.storageKey)
}
