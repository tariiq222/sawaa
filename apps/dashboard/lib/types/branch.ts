/**
 * Branch Types — Deqah Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Entities ─── */

export interface Branch {
  id: string
  nameAr: string
  nameEn: string
  addressAr: string | null
  addressEn: string | null
  phone: string | null
  isMain: boolean
  isActive: boolean
  timezone: string
  createdAt: string
  updatedAt: string
}

export interface BranchEmployeeAssignment {
  id: string
  employeeId: string
  branchId: string
  employee: {
    id: string
    isActive: boolean
    specialty: string | null
    specialtyAr: string | null
    name: string
    nameEn: string
    email: string | null
  }
}

/* ─── Query ─── */

export interface BranchListQuery extends PaginatedQuery {
  search?: string
  isActive?: boolean
}

/* ─── DTOs ─── */

export interface CreateBranchPayload {
  nameAr: string
  nameEn?: string
  addressAr?: string
  addressEn?: string
  phone?: string
  isMain?: boolean
  isActive?: boolean
  timezone?: string
}

export interface UpdateBranchPayload {
  nameAr?: string
  nameEn?: string
  addressAr?: string
  addressEn?: string
  phone?: string
  isMain?: boolean
  isActive?: boolean
  timezone?: string
}
