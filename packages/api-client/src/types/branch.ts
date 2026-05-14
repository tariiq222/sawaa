import type { PaginatedResponse, PaginationParams } from './api'

export interface BranchListItem {
  id: string
  nameAr: string
  nameEn: string
  address: string | null
  phone: string | null
  email: string | null
  isMain: boolean
  isActive: boolean
  timezone: string | null
  createdAt: string
}

export interface BranchListQuery extends PaginationParams {
  isActive?: boolean
}

export interface CreateBranchPayload {
  nameAr: string
  nameEn: string
  address?: string
  phone?: string
  email?: string
  isMain?: boolean
  isActive?: boolean
  timezone?: string
}

export interface UpdateBranchPayload {
  nameAr?: string
  nameEn?: string
  address?: string
  phone?: string
  email?: string
  isMain?: boolean
  isActive?: boolean
  timezone?: string
}

export type BranchListResponse = PaginatedResponse<BranchListItem>
