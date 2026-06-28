export interface Department {
  id: string
  nameAr: string
  nameEn: string
  descriptionAr: string | null
  descriptionEn: string | null
  icon: string | null
  sortOrder: number
  isActive: boolean
  isVisible: boolean
  createdAt: string
  updatedAt: string
  _count?: { categories: number }
  /** Active categories that have ≥1 bookable service. 0 ⇒ wizard disables the department. */
  bookableCategoriesCount?: number
  categories?: Array<{ id: string; nameAr: string; nameEn: string | null }>
}

export interface DepartmentListQuery {
  page?: number
  limit?: number
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
  isVisible?: boolean
}

export interface UpdateDepartmentPayload {
  nameAr?: string
  nameEn?: string
  descriptionAr?: string
  descriptionEn?: string
  icon?: string
  sortOrder?: number
  isActive?: boolean
  isVisible?: boolean
}
