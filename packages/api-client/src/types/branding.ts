import type { BrandingConfig } from '@deqah/shared/types'

export type UpdateBrandingPayload = Partial<Omit<BrandingConfig, 'id' | 'createdAt' | 'updatedAt'>>

export type { BrandingConfig }
