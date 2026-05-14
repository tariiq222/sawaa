import { apiRequest } from '../client'

export interface MediaFile {
  id: string
  organizationId: string
  filename: string
  mimetype: string
  size: number
  visibility: 'PUBLIC' | 'PRIVATE'
  ownerType?: string | null
  ownerId?: string | null
  uploadedBy?: string | null
  url?: string
  createdAt: string
}

export interface UploadFilePayload {
  file: File | Blob
  visibility?: 'PUBLIC' | 'PRIVATE'
  ownerType?: string
  ownerId?: string
  uploadedBy?: string
}

export async function upload(payload: UploadFilePayload): Promise<MediaFile> {
  const form = new FormData()
  form.append('file', payload.file)
  if (payload.visibility) form.append('visibility', payload.visibility)
  if (payload.ownerType) form.append('ownerType', payload.ownerType)
  if (payload.ownerId) form.append('ownerId', payload.ownerId)
  if (payload.uploadedBy) form.append('uploadedBy', payload.uploadedBy)
  return apiRequest<MediaFile>('/dashboard/media/upload', {
    method: 'POST',
    body: form,
  })
}

export async function get(id: string): Promise<MediaFile> {
  return apiRequest<MediaFile>(`/dashboard/media/${id}`)
}

export async function remove(id: string): Promise<void> {
  return apiRequest<void>(`/dashboard/media/${id}`, { method: 'DELETE' })
}

export interface PresignedUrlResponse {
  url: string
  expiresAt: string
}

export async function presignedUrl(
  id: string,
  expirySeconds?: number,
): Promise<PresignedUrlResponse> {
  const qs = expirySeconds ? `?expirySeconds=${expirySeconds}` : ''
  return apiRequest<PresignedUrlResponse>(
    `/dashboard/media/${id}/presigned-url${qs}`,
  )
}
