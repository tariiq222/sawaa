import { render as baseRender, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ canCreate: false, page: 1, setPage: vi.fn(), archive: vi.fn(), categoryMut: vi.fn(), departmentMut: vi.fn(), router: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('sonner',()=>({toast:{success:state.success,error:state.error}}))
vi.mock('next/navigation', () => ({ useRouter: () => ({push:state.router}), usePathname: () => '/categories' }))
vi.mock('@/components/locale-provider', () => ({useLocale: () => ({locale:'en',dir:'ltr',t:(key:string)=>key})}))
vi.mock('@/components/providers/auth-provider', () => ({useAuth: () => ({canDo: (_module:string, action:string) => action==='create' ? state.canCreate : true})}))
vi.mock('@/components/features/breadcrumbs', () => ({Breadcrumbs: () => null}))
vi.mock('@/components/features/services/delete-category-dialog', () => ({DeleteCategoryDialog: () => null}))
vi.mock('@/components/features/departments/delete-department-dialog', () => ({DeleteDepartmentDialog: () => null}))
vi.mock('@/components/features/packages/delete-package-dialog', () => ({DeletePackageDialog: () => null}))
vi.mock('@/hooks/use-services', () => ({useCategoriesList: () => ({categories:Array.from({length:20},(_,i)=>({id:`category-${i}`,ref:i,nameAr:`تصنيف ${i}`,nameEn:`Category ${i}`,isActive:true,bookingMode:'SERVICES',kind:'CLINIC',_count:{services:1}})),meta:{page:1,totalPages:3,total:60,hasNextPage:true,hasPreviousPage:false},page:1,setPage:state.setPage,isLoading:false,error:null,search:'',isActive:undefined,setSearch:vi.fn(),setIsActive:vi.fn(),resetFilters:vi.fn(),refetch:vi.fn()})}))
vi.mock('@/hooks/use-departments', () => ({useDepartments: () => ({departments:[{id:'dept',nameAr:'قسم',nameEn:'Department',isActive:true,isVisible:false}],meta:{totalPages:1},page:1,setPage:state.setPage,isLoading:false,error:null,search:'',isActive:undefined,setSearch:vi.fn(),setIsActive:vi.fn(),resetFilters:vi.fn(),refetch:vi.fn()}),useDepartmentMutations:()=>({updateMut:{mutate:state.departmentMut}})}))
vi.mock('@/hooks/use-package-families', () => ({usePackageFamilyMutations: () => ({archiveMut:{mutateAsync:state.archive,isPending:false}})}))
import { TooltipProvider } from '@sawaa/ui'
const render = (element: React.ReactNode) => baseRender(<TooltipProvider>{element}</TooltipProvider>)
import { CategoryListPage } from '@/components/features/services/category-list-page'
import { DepartmentListPage } from '@/components/features/departments/department-list-page'
import { PackageFamilyCard } from '@/components/features/packages/package-family-card'
afterEach(cleanup)
beforeEach(()=>{vi.clearAllMocks();state.canCreate=false})
it('shows all twenty server rows and forwards the single server pager to later pages', () => {
  render(<CategoryListPage />)
  expect(screen.getByText('Category 19')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'table.next'}))
  expect(state.setPage).toHaveBeenCalledWith(2)
  expect(screen.getAllByRole('button',{name:'table.next'})).toHaveLength(1)
})
it('hides category and department create actions without create permission and exposes visibility', () => {
  const category = render(<CategoryListPage />)
  expect(screen.queryByRole('button',{name:'services.categories.addCategory'})).toBeNull()
  category.unmount()
  render(<DepartmentListPage />)
  expect(screen.queryByRole('button',{name:'departments.addDepartment'})).toBeNull()
  expect(screen.getByText('catalog.hidden')).toBeInTheDocument()
})
it('shows family/option status and money, confirms archive and targets the family ID', async () => {
  state.archive.mockResolvedValue(undefined)
  render(<PackageFamilyCard family={{id:'family-1',nameAr:'أسرة',nameEn:'Family',isStandalone:false,isActive:true,isPublic:false,options:[{id:'option-1',nameAr:'خمس',nameEn:'Five',isActive:true,sessionCount:5,price:{finalPrice:12500}}]} as never} locale="en" canArchive t={key=>key} />)
  expect(screen.getByText('catalog.hidden')).toBeInTheDocument()
  expect(screen.getByText(/125/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'catalog.familyArchive'}))
  expect(state.archive).not.toHaveBeenCalled()
  fireEvent.click(screen.getAllByRole('button',{name:'catalog.familyArchive'}).at(-1)!)
  await waitFor(()=>expect(state.archive).toHaveBeenCalledWith('family-1'))
})

it('reports both outcomes when department activation changes', () => {
  render(<DepartmentListPage />)
  fireEvent.click(screen.getByRole('button',{name:'departments.action.deactivate'}))
  const [payload,callbacks] = state.departmentMut.mock.calls[0]
  expect(payload).toEqual({id:'dept',isActive:false})
  callbacks.onSuccess()
  callbacks.onError()
  expect(state.success).toHaveBeenCalledWith('catalog.statusSaved')
  expect(state.error).toHaveBeenCalledWith('catalog.statusError')
})
