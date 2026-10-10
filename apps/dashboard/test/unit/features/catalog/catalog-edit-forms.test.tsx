import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
const state=vi.hoisted(()=>({department:{id:'department-id',nameAr:'قسم',nameEn:'Department',descriptionAr:'قديم',descriptionEn:'Old',icon:'old-icon',isActive:true,isVisible:true},update:vi.fn().mockResolvedValue({}),useCategory:vi.fn(),useDepartment:vi.fn(),push:vi.fn()}))
vi.mock('next/navigation',()=>({useRouter:()=>({push:state.push}),useSearchParams:()=>new URLSearchParams('tab=unsupported')}))
vi.mock('@/components/locale-provider',()=>({useLocale:()=>({locale:'en',t:(key:string)=>key})}))
vi.mock('@/components/features/breadcrumbs',()=>({Breadcrumbs:()=>null}))
vi.mock('@/hooks/use-services',()=>({useCategoryMutations:()=>({createMut:{mutateAsync:vi.fn()},updateMut:{mutateAsync:state.update},uploadMut:{mutateAsync:vi.fn()}})}))
vi.mock('@/hooks/use-categories',()=>({useCategory:(id:string)=>{state.useCategory(id);return {data:{id:'category-id',ref:25,nameAr:'عيادة',nameEn:'Clinic',kind:'CLINIC',bookingMode:'SERVICES',isActive:true},isLoading:false}}}))
vi.mock('@/hooks/use-departments',()=>({useDepartmentOptions:()=>({options:[],isLoading:false}),useDepartment:(id:string)=>{state.useDepartment(id);return {data:state.department,isLoading:false}},useDepartmentMutations:()=>({createMut:{isPending:false},updateMut:{mutateAsync:state.update,isPending:false}})}))
vi.mock('@/components/features/shared/service-avatar-picker',()=>({ServiceAvatarPicker:()=>null}))
vi.mock('@/components/features/services/category-services-tab',()=>({CategoryServicesTab:()=>null}))
vi.mock('@/components/features/services/category-settings-tab',()=>({CategorySettingsTab:()=>null}))
vi.mock('@/components/features/services/category-employees-tab',()=>({CategoryEmployeesTab:()=>null}))
import { CategoryFormPage } from '@/components/features/services/category-form-page'
import { DepartmentFormPage } from '@/components/features/departments/department-form-page'
afterEach(()=>{cleanup();vi.clearAllMocks()})
it('loads the exact later-page category and shows the information tab for an invalid tab query',async()=>{
  render(<CategoryFormPage mode="edit" categoryId="CAT-25" />)
  await waitFor(()=>expect(screen.getByPlaceholderText('services.categories.create.nameAr')).toHaveValue('عيادة'))
  expect(state.useCategory).toHaveBeenCalledWith('CAT-25')
  expect(screen.getByRole('tabpanel')).toContainElement(screen.getByPlaceholderText('services.categories.create.nameAr'))
  fireEvent.change(screen.getByPlaceholderText('services.categories.create.nameEn'),{target:{value:''}})
  fireEvent.click(screen.getByRole('button',{name:'services.categories.wizard.next'}))
  await waitFor(()=>expect(state.update).toHaveBeenCalledWith(expect.objectContaining({id:'category-id',nameEn:null})))
})
it('loads a department by ID and submits explicit nulls when optional fields are cleared',async()=>{
  render(<DepartmentFormPage mode="edit" departmentId="department-id" />)
  await waitFor(()=>expect(screen.getByLabelText('departments.field.descriptionAr')).toHaveValue('قديم'))
  for (const label of ['descriptionAr','descriptionEn','icon']) fireEvent.change(screen.getByLabelText(`departments.field.${label}`),{target:{value:''}})
  fireEvent.click(screen.getByRole('button',{name:'departments.edit.submit'}))
  await waitFor(()=>expect(state.update).toHaveBeenCalledWith(expect.objectContaining({id:'department-id',descriptionAr:null,descriptionEn:null,icon:null})))
  expect(state.useDepartment).toHaveBeenCalledWith('department-id')
})
