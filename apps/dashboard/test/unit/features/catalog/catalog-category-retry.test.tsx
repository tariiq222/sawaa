import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useCategoryCreation } from '@/hooks/use-category-creation'
import type { EditCategoryFormData } from '@/lib/schemas/service.schema'
import type { ServiceCategory } from '@/lib/types/service'

it('reuses a created category after image failure, preserves booking mode, and applies the revised draft', async () => {
  const record = { id: 'category-id', ref: 25, nameAr: 'عيادة', bookingMode: 'DIRECT' } as ServiceCategory
  const create = vi.fn().mockResolvedValue(record)
  const update = vi.fn().mockResolvedValue(record)
  const upload = vi.fn().mockRejectedValueOnce(new Error('upload failed')).mockResolvedValue(record)
  const file = {current: new File(['image'], 'image.png', {type:'image/png'}) as File | null}
  const uploaded = vi.fn()
  const draft = {nameAr:'عيادة',nameEn:'Clinic',kind:'CLINIC',bookingMode:'DIRECT',departmentId:'department-id'} as EditCategoryFormData
  const {result} = renderHook(() => useCategoryCreation({create,update,upload},file,uploaded))
  await act(async () => { await expect(result.current.save(draft)).rejects.toThrow('upload failed') })
  expect(result.current.record?.bookingMode).toBe('DIRECT')
  expect(file.current).not.toBeNull()
  await act(async () => {await result.current.save({...draft,nameAr:'عيادة جديدة',nameEn:'',bookingMode:'SERVICES'})})
  expect(create).toHaveBeenCalledTimes(1)
  expect(update).toHaveBeenCalledWith('category-id',expect.objectContaining({nameAr:'عيادة جديدة',nameEn:null}))
  expect(update.mock.calls[0][1]).not.toHaveProperty('bookingMode')
  expect(upload.mock.calls.map(args=>args[0])).toEqual(['category-id','category-id'])
  expect(file.current).toBeNull()
  expect(uploaded).toHaveBeenCalledTimes(1)
})
