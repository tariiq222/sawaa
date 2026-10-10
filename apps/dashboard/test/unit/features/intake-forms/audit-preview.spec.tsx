import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
vi.mock('next/navigation',()=>({useParams:()=>({id:'f1'}),useRouter:()=>({replace:vi.fn()}),usePathname:()=>'/intake-forms/f1'}))
vi.mock('@/components/features/permission-guard',()=>({PermissionGuard:({children}:React.PropsWithChildren)=>children}))
vi.mock('@/components/features/breadcrumbs',()=>({Breadcrumbs:()=>null}))
vi.mock('@/components/locale-provider',()=>({useLocale:()=>({locale:'ar',t:(k:string)=>k})}))
vi.mock('@/lib/api/intake-forms',()=>({fetchIntakeForm:async()=>({id:'f1',nameAr:'نموذج استقبال',nameEn:null,type:'pre_session',scope:'global',isActive:true,submissionsCount:0,fields:[{id:'q1',labelAr:'اختر الحالة',labelEn:null,fieldType:'select',isRequired:true,options:['متزوج','أعزب']}]})}))
import IntakeFormDetail from '@/app/(dashboard)/intake-forms/[id]/page'
describe('intake preview route',()=>{
 it('renders answer controls without an edit redirect or save mutation',async()=>{
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><IntakeFormDetail /></QueryClientProvider>)
  expect(await screen.findByRole('heading',{name:'نموذج استقبال'})).toBeVisible()
  expect(screen.getByRole('combobox',{name:/اختر الحالة/})).toBeVisible()
  expect(screen.getByRole('option',{name:'متزوج'})).toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'common.save'})).toBeNull()
 })
})
