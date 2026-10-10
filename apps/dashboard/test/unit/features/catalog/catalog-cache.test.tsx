import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
const update = vi.hoisted(()=>vi.fn())
const upload = vi.hoisted(()=>vi.fn())
vi.mock('@/lib/api/services',()=>({updateCategory:update,uploadCategoryImage:upload,createCategory:vi.fn(),deleteCategory:vi.fn(),fetchAllCategories:vi.fn(),fetchCategory:vi.fn(),fetchCategories:vi.fn()}))
import { useCategoryMutations } from '@/hooks/use-categories'
it('invalidates embedded category labels in service detail/list caches after editing a category',async()=>{
  const client=new QueryClient()
  const invalidate=vi.spyOn(client,'invalidateQueries')
  update.mockResolvedValue({id:'cat'})
  const {result}=renderHook(()=>useCategoryMutations(),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>})
  await act(async()=>{await result.current.updateMut.mutateAsync({id:'cat',nameAr:'new name'})})
  expect(invalidate).toHaveBeenCalledWith({queryKey:['services'],refetchType:'all'})
})

it('invalidates services again after category image persistence completes',async()=>{
  const client=new QueryClient()
  const invalidate=vi.spyOn(client,'invalidateQueries')
  upload.mockResolvedValue({id:'cat',imageUrl:'stored-key'})
  const {result}=renderHook(()=>useCategoryMutations(),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>})
  await act(async()=>{await result.current.uploadMut.mutateAsync({id:'cat',file:new File(['image'],'image.png')})})
  expect(invalidate).toHaveBeenCalledWith({queryKey:['services'],refetchType:'all'})
})
