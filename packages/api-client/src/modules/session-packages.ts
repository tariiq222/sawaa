import { apiRequest } from '../client'
import type {
  SessionPackageListQuery,
  SessionPackageListResponse,
  SessionPackageDetail,
  CreateSessionPackagePayload,
  UpdateSessionPackagePayload,
} from '../types/session-package'

/**
 * Hand-written module for the session-package management endpoints under
 * `/dashboard/organization/packages`. The backend serves these from
 * `apps/backend/src/api/dashboard/organization-settings.controller.ts`
 * (Session Packages block).
 *
 * The Create / Update endpoints currently sit behind dashboard auth and
 * the `Service:create` / `Service:update` permissions. Public catalog and
 * purchase flows are coming in a later phase and will live alongside this
 * module.
 */

function buildQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value))
    }
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export async function listSessionPackages(
  query: SessionPackageListQuery = {},
): Promise<SessionPackageListResponse> {
  const qs = buildQueryString({
    page: query.page,
    limit: query.limit,
    search: query.search,
    isActive: query.isActive,
    isPublic: query.isPublic,
  })
  return apiRequest<SessionPackageListResponse>(
    `/dashboard/organization/packages${qs}`,
  )
}

export async function getSessionPackage(
  id: string,
): Promise<SessionPackageDetail> {
  return apiRequest<SessionPackageDetail>(
    `/dashboard/organization/packages/${id}`,
  )
}

export async function createSessionPackage(
  payload: CreateSessionPackagePayload,
): Promise<SessionPackageDetail> {
  return apiRequest<SessionPackageDetail>(
    '/dashboard/organization/packages',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export async function updateSessionPackage(
  id: string,
  payload: UpdateSessionPackagePayload,
): Promise<SessionPackageDetail> {
  return apiRequest<SessionPackageDetail>(
    `/dashboard/organization/packages/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
}

/**
 * Soft-archive a session package. The controller returns 204 No Content,
 * so this resolves to `void`. The handler still returns `{ id }` for
 * non-HTTP callers, but at the HTTP boundary the body is empty.
 */
export async function archiveSessionPackage(id: string): Promise<void> {
  return apiRequest<void>(`/dashboard/organization/packages/${id}`, {
    method: 'DELETE',
  })
}
