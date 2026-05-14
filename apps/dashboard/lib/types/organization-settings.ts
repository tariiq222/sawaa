/**
 * Organization Settings Types — Deqah Dashboard
 */

export interface OrganizationSettings {
  id: string
  companyNameAr: string | null
  companyNameEn: string | null
  businessRegistration: string | null
  vatRegistrationNumber: string | null
  vatRate: number
  sellerAddress: string | null
  organizationCity: string
  postalCode: string | null
  contactPhone: string | null
  contactEmail: string | null
  address: string | null
  socialMedia: Record<string, string> | null
  aboutAr: string | null
  aboutEn: string | null
  privacyPolicyAr: string | null
  privacyPolicyEn: string | null
  termsAr: string | null
  termsEn: string | null
  cancellationPolicyAr: string | null
  cancellationPolicyEn: string | null
  defaultLanguage: string
  timezone: string
  weekStartDay: string
  dateFormat: string
  timeFormat: string
  emailHeaderShowLogo: boolean
  emailHeaderShowName: boolean
  emailFooterPhone: string | null
  emailFooterWebsite: string | null
  emailFooterInstagram: string | null
  emailFooterTwitter: string | null
  emailFooterSnapchat: string | null
  emailFooterTiktok: string | null
  emailFooterLinkedin: string | null
  emailFooterYoutube: string | null
  sessionDuration: number
  reminderBeforeMinutes: number
  createdAt: string
  updatedAt: string
}

export type UpdateOrganizationSettingsPayload = Partial<
  Omit<OrganizationSettings, "id" | "createdAt" | "updatedAt">
>

export interface PublicOrganizationSettings {
  contactPhone: string | null
  contactEmail: string | null
  address: string | null
  socialMedia: Record<string, string> | null
  cancellationPolicyAr: string | null
  cancellationPolicyEn: string | null
}
