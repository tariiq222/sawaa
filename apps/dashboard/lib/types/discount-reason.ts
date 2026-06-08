export interface DiscountReason {
  id: string
  labelAr: string
  labelEn: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateDiscountReasonInput {
  labelAr: string
  labelEn?: string
  isActive?: boolean
  sortOrder?: number
}

export interface UpdateDiscountReasonInput {
  labelAr?: string
  labelEn?: string
  isActive?: boolean
  sortOrder?: number
}
