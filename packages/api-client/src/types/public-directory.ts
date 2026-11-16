export interface PublicBranch {
  id: string
  nameAr: string
  nameEn: string | null
  city: string | null
  addressAr: string | null
  isMain: boolean
}

/**
 * `GET /public/employees` and `GET /public/employees/:key`.
 *
 * Mirrors the documented `PublicEmployeeProfileDto` in the committed OpenAPI
 * snapshot (the base `PublicEmployeeResponseDto` plus the three fields the
 * handler has always emitted). This package is hand-written, so the shape is
 * mirrored deliberately — it is never regenerated from the snapshot.
 */
export interface PublicEmployeeSyntheticUser {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  avatarUrl: string | null
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
  experience: number
  languages: string[]
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
  /** Synthetic user shape kept for legacy consumers (names + avatar). */
  user: PublicEmployeeSyntheticUser
  /** Legacy alias of `ratingAverage`; 0 when there are no public ratings. */
  rating: number
  /** Legacy alias of `ratingCount`. */
  reviewCount: number
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
