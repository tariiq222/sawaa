import { describe, expect, it } from 'vitest'
import { buildCategoryUpdatePayload } from '@/components/features/services/category-create-payload'
import * as familyForm from '@/lib/package-family-form'

describe('catalog clearing and optional family names', () => {
  it('clears category text, icon and image with explicit null', () => {
    expect(buildCategoryUpdatePayload('id', { nameEn: '', iconName: null, iconBgColor: null }, null, null)).toMatchObject({ nameEn: null, iconName: null, iconBgColor: null, imageUrl: null, departmentId: null })
  })
  it('omits blank optional family/option English names on create and uses null on edit', () => {
    const input = { nameAr: 'الأسرة', nameEn: ' ', options: [{ nameAr: 'خمس جلسات', nameEn: '', groups: [], globalDiscount: { type: 'NONE', value: 0 } }] } as never
    expect(familyForm.normalizePackageFamilyInput(input, false)).toMatchObject({ nameEn: undefined, options: [{ nameEn: undefined }] })
    expect(familyForm.normalizePackageFamilyInput(input, true)).toMatchObject({ nameEn: null, options: [{ nameEn: null }] })
  })
})
