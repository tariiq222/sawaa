import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TooltipProvider } from '@sawaa/ui'
const {state,push,refetch} = vi.hoisted(()=>({state:{isLoading:false,error:null as string|null,forms:[] as unknown[]},push:vi.fn(),refetch:vi.fn()}))
vi.mock('next/navigation',()=>({useRouter:()=>({push})}))
vi.mock('@/components/features/breadcrumbs',()=>({Breadcrumbs:()=>null}))
vi.mock('@/components/providers/auth-provider',()=>({useAuth:()=>({canDo:()=>true})}))
vi.mock('@/components/locale-provider',()=>({useLocale:()=>({locale:'ar',t:(key:string)=>key})}))
vi.mock('@/hooks/use-intake-forms',()=>({useIntakeForms:()=>({...state,refetch,search:'',setSearch:vi.fn(),isActive:undefined,setIsActive:vi.fn(),hasFilters:false,resetFilters:vi.fn()}),useIntakeFormMutations:()=>({update:vi.fn(),delete:vi.fn()})}))
import IntakeFormsPage from '@/app/(dashboard)/intake-forms/page'
describe('intake forms list states',()=>{
 beforeEach(()=>{state.isLoading=false;state.error=null;state.forms=[];vi.clearAllMocks()})
 it('announces loading instead of an empty list',()=>{
  state.isLoading=true
  render(<IntakeFormsPage />)
  expect(screen.getByRole('status')).toHaveTextContent('common.loading')
  expect(screen.queryByText('intakeForms.empty.title')).toBeNull()
 })
 it('offers retry for a failed list without claiming it is empty',()=>{
  state.error='failed'
  render(<IntakeFormsPage />)
  fireEvent.click(screen.getByRole('button',{name:'common.retry'}))
  expect(refetch).toHaveBeenCalled()
  expect(screen.queryByText('intakeForms.empty.title')).toBeNull()
 })
 it('opens the actual preview route and preserves the target scope name',()=>{
  state.forms=[{id:'form1',nameAr:'نموذج',nameEn:null,type:'pre_session',scope:'service',scopeLabel:'خدمة المتابعة',scopeId:'service1',isActive:true,fields:[],submissionsCount:0}]
  render(<TooltipProvider><IntakeFormsPage /></TooltipProvider>)
  expect(screen.getByText('خدمة المتابعة')).toBeVisible()
  fireEvent.click(screen.getByRole('button',{name:'intakeForms.col.preview'}))
  expect(push).toHaveBeenCalledWith('/intake-forms/form1')
 })
})
