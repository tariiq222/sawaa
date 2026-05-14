import type { PaginatedResponse, PaginationParams } from './api'

export interface DepartmentListItem {
  id: string
  nameAr: string
  nameEn: string
  descriptionAr: string | null
  descriptionEn: string | null
  icon: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
}

export interface DepartmentListQuery extends PaginationParams {
  isActive?: boolean
}

export interface CreateDepartmentPayload {
  nameAr: string
  nameEn: string
  descriptionAr?: string
  descriptionEn?: string
  icon?: string
  sortOrder?: number
  isActive?: boolean
}

export interface UpdateDepartmentPayload {
  nameAr?: string
  nameEn?: string
  descriptionAr?: string
  descriptionEn?: string
  icon?: string
  sortOrder?: number
  isActive?: boolean
}

export type DepartmentListResponse = PaginatedResponse<DepartmentListItem>
