export interface PublicBranch {
  id: string
  nameAr: string
  nameEn: string | null
  city: string | null
  addressAr: string | null
  isMain: boolean
}

export interface PublicEmployee {
  id: string
  slug: string | null
  nameAr: string | null
  nameEn: string | null
  title: string | null
  specialty: string | null
  specialtyAr: string | null
  publicBioAr: string | null
  publicBioEn: string | null
  publicImageUrl: string | null
  gender: string | null
  employmentType: string
  ratingAverage: number | null
  ratingCount: number
  minServicePrice: number | null
  isAvailableToday: boolean
  serviceIds: string[]
  branchIds: string[]
  isBookable: boolean
  availableDaysOfWeek: number[]
}

export type ContactMessageStatus = 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED'

export interface ContactMessage {
  id: string
  name: string
  phone: string | null
  email: string | null
  subject: string | null
  body: string
  status: ContactMessageStatus
  createdAt: string
  readAt: string | null
  archivedAt: string | null
}

export interface CreateContactMessagePayload {
  name: string
  phone?: string
  email?: string
  subject?: string
  body: string
}
