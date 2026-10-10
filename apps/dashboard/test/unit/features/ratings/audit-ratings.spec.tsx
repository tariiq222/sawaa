import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
const mutation=vi.hoisted(()=>vi.fn((_input: {id:string;isPublic:boolean}, options?: {onError?: () => void})=> options?.onError?.()))
const toastError=vi.hoisted(()=>vi.fn())
vi.mock('sonner',()=>({toast:{error:toastError,success:vi.fn()}}))
vi.mock('@/components/locale-provider',()=>({useLocale:()=>({locale:'ar',t:(k:string)=>k})}))
vi.mock('@/hooks/use-ratings',()=>({useRatings:()=>({ratings:[{id:'r1',stars:5,isPublic:false,createdAt:'2026-10-01',employee:{name:'أحمد'}},{id:'r2',stars:3,isPublic:true,createdAt:'2026-10-01',employee:{name:'سالم'}}],meta:{total:30},averageRating:3.8,isLoading:false,error:null}),useRatingMutations:()=>({updateVisibility:{mutate:mutation,isPending:true,variables:{id:'r1'}}})}))
import { RatingsManagementTab } from '@/components/features/ratings/ratings-management-tab'
describe('rating moderation information',()=>{
 it('shows rated practitioners and full-list average',()=>{
  render(<RatingsManagementTab />)
  expect(screen.getByText('أحمد')).toBeVisible()
  expect(screen.getByText(/3.80/)).toBeVisible()
 })
 it('keeps other cards operable during a row mutation and reports failures',()=>{
  render(<RatingsManagementTab />)
  expect(screen.getAllByRole('switch')[0]).toBeDisabled()
  expect(screen.getAllByRole('switch')[1]).not.toBeDisabled()
  fireEvent.click(screen.getAllByRole('switch')[1])
  expect(toastError).toHaveBeenCalledWith('auditOperations.saveError')
 })
})
