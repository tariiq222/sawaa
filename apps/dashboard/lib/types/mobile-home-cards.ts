export type MobileHomeCardDestination =
  | "CLINICS"
  | "SERVICES"
  | "SPECIALISTS"
  | "PACKAGES"
  | "PROGRAMS"

export interface MobileHomeCardContent {
  titleAr: string
  titleEn: string | null
  descriptionAr: string | null
  descriptionEn: string | null
  imageFileId: string | null
  imageAltAr: string | null
  imageAltEn: string | null
  destination: MobileHomeCardDestination | null
}

export interface AdminMobileHomeCard extends MobileHomeCardContent {
  id: string
  imageUrl: string | null
  sortOrder: number
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export interface PublicMobileHomeCard extends Omit<MobileHomeCardContent, "imageFileId"> {
  id: string
  imageUrl: string | null
}

export type CreateMobileHomeCardPayload = MobileHomeCardContent & {
  sortOrder?: number
  isPublished?: boolean
}

export type UpdateMobileHomeCardPayload = Partial<MobileHomeCardContent> & {
  expectedUpdatedAt: string
  isPublished?: boolean
  sortOrder?: number
}

export interface MobileHomeCardOrderItem {
  id: string
  expectedUpdatedAt: string
}
