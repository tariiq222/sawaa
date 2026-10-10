import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({branch:vi.fn(),sort:vi.fn(),refetch:vi.fn()}))
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}))
vi.mock('@/components/locale-provider',()=>({useLocale:()=>({locale:'en',t:(key:string)=>key})}))
vi.mock('@/components/providers/auth-provider',()=>({useAuth:()=>({canDo:()=>true})}))
vi.mock('@/hooks/use-services',()=>({useServices:()=>({services:[],isLoading:false,error:'offline',search:'',sortBy:'createdAt',sortOrder:'desc',setBranchId:state.branch,setSorting:state.sort,refetch:state.refetch}),useCategories:()=>({data:{items:[]}}),useServiceMutations:()=>({deleteMut:{mutateAsync:vi.fn()}})}))
vi.mock('@/hooks/use-branches',()=>({useBranches:()=>({branches:[{id:'branch-id',nameAr:'فرع',nameEn:'Branch'}]})}))
vi.mock('@/components/features/filter-bar',()=>({FilterBar:({selects}:{selects:Array<{key:string;value:string;onValueChange:(value:string)=>void;options:Array<{value:string;label:string}>}>})=><>{selects.map(select=><select key={select.key} aria-label={select.key} value={select.value} onChange={event=>select.onValueChange(event.target.value)}>{select.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>)}</>}))
vi.mock('@/components/features/data-table',()=>({DataTable:()=>null}))
vi.mock('@/components/features/services/service-detail-sheet',()=>({ServiceDetailSheet:()=>null}))
vi.mock('@/components/features/services/service-columns',()=>({getServiceColumns:()=>[]}))
import { ServicesTabContent } from '@/components/features/services/services-tab-content'
import { ServiceBreadcrumb } from '@/components/features/services/service-breadcrumb'
afterEach(()=>{cleanup();vi.clearAllMocks()})
it('forwards branch and global sort choices and retries a failed list request',()=>{
  render(<ServicesTabContent />)
  fireEvent.change(screen.getByLabelText('branch'),{target:{value:'branch-id'}})
  fireEvent.change(screen.getByLabelText('sort'),{target:{value:'price:asc'}})
  fireEvent.click(screen.getByRole('button',{name:'common.retry'}))
  expect(state.branch).toHaveBeenCalledWith('branch-id')
  expect(state.sort).toHaveBeenCalledWith('price','asc')
  expect(state.refetch).toHaveBeenCalledTimes(1)
})
it('links the department breadcrumb to its supported detail route',()=>{
  render(<ServiceBreadcrumb departmentName="Department" departmentId="department-id" categoryName="Category" categoryId="category-id" serviceName="Service" dir="ltr" />)
  expect(screen.getByRole('link',{name:'Department'})).toHaveAttribute('href','/departments/department-id/edit')
  expect(screen.getByRole('link',{name:'Category'})).toHaveAttribute('href','/categories/category-id/edit')
})
