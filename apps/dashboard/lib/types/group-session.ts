/**
 * Group Session types — Sawaa Dashboard
 */

export type GroupSessionStatus = 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED'
export type GroupSessionDeliveryType = 'IN_PERSON' | 'ONLINE'

export interface GroupSessionListItem {
  id: string
  title: string
  scheduledAt: string
  durationMins: number
  maxCapacity: number
  enrolledCount: number
  price: number
  status: GroupSessionStatus
  deliveryType: GroupSessionDeliveryType
  isPublic: boolean
  employeeId: string
  serviceId: string
  spotsLeft: number
}

export interface GroupSessionEnrollment {
  id: string
  clientId: string
  client: { id: string; firstName: string; lastName: string; phone: string | null }
  enrolledAt: string
  status: string
}

export interface GroupSessionDetail extends GroupSessionListItem {
  descriptionAr: string | null
  descriptionEn: string | null
  publicDescriptionAr: string | null
  publicDescriptionEn: string | null
  branchId: string
  createdAt: string
  enrollments: GroupSessionEnrollment[]
  employee: { id: string; user: { firstName: string; lastName: string } }
  service: { id: string; nameAr: string; nameEn: string }
}

export interface GroupSessionListQuery {
  page?: number
  limit?: number
  status?: GroupSessionStatus
  upcoming?: boolean
}

export interface CreateGroupSessionPayload {
  branchId: string
  employeeId: string
  serviceId: string
  title: string
  descriptionAr?: string
  descriptionEn?: string
  scheduledAt: string
  durationMins: number
  maxCapacity: number
  price: number
  deliveryType: GroupSessionDeliveryType
  isPublic?: boolean
  publicDescriptionAr?: string
  publicDescriptionEn?: string
}
