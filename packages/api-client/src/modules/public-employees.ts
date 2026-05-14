import { apiRequest } from '../client'
import type { PublicEmployee } from '../types/public-directory'

export async function list(): Promise<PublicEmployee[]> {
  return apiRequest<PublicEmployee[]>('/public/employees')
}

export async function getBySlug(slug: string): Promise<PublicEmployee> {
  return apiRequest<PublicEmployee>(`/public/employees/${encodeURIComponent(slug)}`)
}
