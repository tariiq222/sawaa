import { apiRequest } from '../client'

export interface OrganizationSettings {
  id: string
  companyNameAr: string | null
  companyNameEn: string | null
  businessRegistration: string | null
  vatRegistrationNumber: string | null
  vatRate: number | null
  sellerAddress: string | null
  organizationCity: string | null
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
  defaultLanguage: string | null
  timezone: string | null
  weekStartDay: string | null
  dateFormat: string | null
  timeFormat: string | null
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
  sessionDuration: number | null
  reminderBeforeMinutes: number | null
  createdAt: string
  updatedAt: string
}

export type UpdateOrganizationSettingsPayload = Partial<
  Omit<OrganizationSettings, 'id' | 'createdAt' | 'updatedAt'>
>

export async function get(): Promise<OrganizationSettings> {
  return apiRequest<OrganizationSettings>('/organization-settings')
}

export async function update(payload: UpdateOrganizationSettingsPayload): Promise<OrganizationSettings> {
  return apiRequest<OrganizationSettings>('/organization-settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
