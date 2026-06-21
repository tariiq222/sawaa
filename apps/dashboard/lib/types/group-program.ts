/**
 * Group Program types — Sawaa Dashboard
 */

export interface GroupProgramListItem {
  id: string
  ref: string
  nameAr: string
  nameEn: string | null
  departmentId: string
  minParticipants: number
  maxParticipants: number
  defaultPrice: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface GroupProgramListQuery {
  activeOnly?: boolean
  departmentId?: string
}

export interface CreateGroupProgramPayload {
  nameAr: string
  nameEn?: string
  departmentId: string
  minParticipants: number
  maxParticipants: number
  defaultPrice: number
  descriptionAr?: string
  descriptionEn?: string
}
