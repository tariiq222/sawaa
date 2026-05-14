export interface Department {
  id: string
  nameAr: string
  nameEn: string
  descriptionAr: string | null
  descriptionEn: string | null
  icon: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { categories: number }
  categories?: Array<{ id: string; nameAr: string; nameEn: string | null }>
}

export interface DepartmentListQuery {
  page?: number
  perPage?: number
  search?: string
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
