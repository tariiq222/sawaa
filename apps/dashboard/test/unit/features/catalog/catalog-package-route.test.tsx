import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({query:{data:undefined as unknown,isLoading:false,error:null as unknown,refetch:vi.fn()},replace:vi.fn()}))
vi.mock('next/navigation',()=>({useParams:()=>({id:'package-id'}),useRouter:()=>({replace:state.replace})}))
vi.mock('@/hooks/use-packages',()=>({usePackage:()=>state.query}))
vi.mock('@/components/features/permission-guard',()=>({PermissionGuard:({children}:{children:React.ReactNode})=>children}))
vi.mock('@/components/locale-provider',()=>({useLocale:()=>({t:(key:string)=>key})}))
import PackageDetailRoute from '@/app/(dashboard)/packages/[id]/page'
afterEach(cleanup)
beforeEach(()=>{vi.clearAllMocks();state.query={data:undefined,isLoading:false,error:null,refetch:vi.fn()}})
it('offers retry on a request error and avoids a permanent redirect placeholder',()=>{
  state.query.error=new Error('offline')
  render(<PackageDetailRoute />)
  expect(screen.getByRole('alert')).toHaveTextContent('common.errorLoading')
  fireEvent.click(screen.getByRole('button',{name:'common.retry'}))
  expect(state.query.refetch).toHaveBeenCalledTimes(1)
  expect(state.replace).not.toHaveBeenCalled()
})
it('uses localized loading and redirects only when the record exists',()=>{
  state.query.isLoading=true
  const view=render(<PackageDetailRoute />)
  expect(screen.getByText('common.loading')).toBeInTheDocument()
  expect(state.replace).not.toHaveBeenCalled()
  state.query={...state.query,isLoading:false,data:{id:'package-id'}}
  view.rerender(<PackageDetailRoute />)
  expect(state.replace).toHaveBeenCalledWith('/packages/package-id/edit')
})
it('displays a missing record without redirecting',()=>{
  render(<PackageDetailRoute />)
  expect(screen.getByText('packages.notFound.title')).toBeInTheDocument()
  expect(state.replace).not.toHaveBeenCalled()
})
