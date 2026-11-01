import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { CreateServiceFormData } from '@/components/features/services/create/form-schema'
const state=vi.hoisted(()=>({record:undefined as unknown,create:vi.fn(),update:vi.fn(),booking:vi.fn(),employees:vi.fn(),error:vi.fn(),push:vi.fn(),upload:vi.fn()}))
vi.mock('next/navigation',()=>({useRouter:()=>({push:state.push}),useSearchParams:()=>new URLSearchParams()}))
// Keep the real mutation/query-client plumbing so the real useServiceImageUpload
// cache pass runs; only the component's read query is stubbed.
vi.mock('@tanstack/react-query',async importOriginal=>({...await importOriginal<object>(),useQuery:()=>({data:state.record,isLoading:false,isError:false})}))
vi.mock('@/components/locale-provider',()=>({useLocale:()=>({locale:'en',t:(key:string)=>key})}))
vi.mock('@/lib/mutation-helpers',()=>({showApiError:state.error}))
// Real useServiceImageUpload (it owns the cache reconciliation under test);
// the other hooks stay stubbed so each test drives one behaviour at a time.
vi.mock('@/hooks/use-services',async importOriginal=>({...await importOriginal<object>(),useServiceMutations:()=>({createMut:{mutateAsync:state.create},updateMut:{mutateAsync:state.update}}),useServiceBookingTypesMutation:()=>({mutateAsync:vi.fn()}),useServiceBookingTypes:()=>({data:undefined})}))
vi.mock('@/lib/api/services',async importOriginal=>({...await importOriginal<object>(),fetchService:vi.fn(),uploadServiceImage:state.upload}))
vi.mock('@/lib/service-creation',()=>({saveCreatedServiceEmployees:state.employees}))
vi.mock('@/components/features/services/service-form-helpers',async importOriginal=>({...await importOriginal<object>(),saveBookingTypesApi:state.booking}))
vi.mock('@/components/features/services/use-service-create-category-context',()=>({useServiceCreateCategoryContext:()=>({categories:[],context:null,validCategory:null})}))
vi.mock('@/components/features/services/service-form-page-header',()=>({ServiceFormPageHeader:()=>null}))
// Mirrors the real BasicInfoTab avatar wiring: a file select registers a blob
// preview + pending file, while clearing or choosing an icon drops both.
// The real component's own callbacks are covered by
// catalog-service-avatar-consistency.test.tsx.
vi.mock('@/components/features/services/create/basic-info-tab',()=>({BasicInfoTab:({form,onImageSelect,onImageClear}:{form:UseFormReturn<CreateServiceFormData>;onImageSelect:(file:File)=>void;onImageClear:()=>void})=><><input aria-label="nameAr" {...form.register('nameAr')} /><input aria-label="nameEn" {...form.register('nameEn')} /><input aria-label="categoryId" {...form.register('categoryId')} /><input aria-label="image reference" {...form.register('imageUrl')} /><input type="file" aria-label="image file" onChange={event=>{const file=event.target.files?.[0];if(file){form.setValue('imageUrl','blob:selected-service-image');onImageSelect(file)}}} /><button type="button" onClick={()=>{form.setValue('imageUrl',null);onImageClear()}}>Clear image</button><button type="button" onClick={()=>{form.setValue('imageUrl',null);form.setValue('iconName','Clock01Icon');onImageClear()}}>Choose icon</button></>}))
vi.mock('@/components/features/services/create/pricing-tab',()=>({PricingTab:()=>null}))
vi.mock('@/components/features/services/create/booking-settings-tab',()=>({BookingSettingsTab:()=>null}))
vi.mock('@/components/features/services/service-employees-tab',()=>({ServiceEmployeesTab:()=>null}))
import { ServiceFormPage } from '@/components/features/services/service-form-page'
const categoryId='550e8400-e29b-41d4-a716-446655440000'
const oldImage='https://media.invalid/old-image?X-Amz-Signature=temporary'
afterEach(cleanup)
beforeEach(()=>{vi.clearAllMocks();state.record=undefined;state.create.mockResolvedValue({id:'created-service'});state.update.mockResolvedValue({});state.booking.mockResolvedValue(undefined);state.employees.mockResolvedValue(undefined);state.upload.mockResolvedValue(undefined)})
function renderForm(ui:ReactNode){
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}})
  const view=render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  return {client,...view}
}
const consultText=async()=>waitFor(()=>expect(screen.getByLabelText('nameAr')).toHaveValue('استشارة'))
it('resumes the actual multi-step create form after booking configuration fails and blocks a double submit',async()=>{
  state.booking.mockRejectedValueOnce(new Error('booking config failed'))
  renderForm(<ServiceFormPage mode="create" />)
  for(const [name,value] of [['nameAr','استشارة'],['nameEn','Consultation'],['categoryId',categoryId]]) fireEvent.change(screen.getByLabelText(name),{target:{value}})
  fireEvent.click(screen.getByRole('button',{name:'services.create.submit'}))
  fireEvent.click(screen.getByRole('button',{name:'services.create.submit'}))
  await waitFor(()=>expect(state.error).toHaveBeenCalledTimes(1))
  expect(state.create).toHaveBeenCalledTimes(1)
  expect(state.push).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'services.create.submit'}))
  await waitFor(()=>expect(state.push).toHaveBeenCalledWith('/services'))
  expect(state.create).toHaveBeenCalledTimes(1)
  expect(state.update).toHaveBeenCalledWith(expect.objectContaining({id:'created-service'}))
  expect(state.booking).toHaveBeenCalledTimes(2)
  expect(state.employees).toHaveBeenCalledWith('created-service',[],{})
})
it('returns to services after editing and omits the unchanged signed image',async()=>{
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:oldImage}
  renderForm(<ServiceFormPage mode="edit" serviceId="saved-service" />)
  await consultText()
  fireEvent.click(screen.getByRole('button',{name:'services.edit.submit'}))
  await waitFor(()=>expect(state.push).toHaveBeenCalledWith('/services'))
  expect(state.update).toHaveBeenCalledWith(expect.objectContaining({id:'saved-service',imageUrl:undefined}))
})

// T10-F2: the detail query refetches every ~4 minutes to rotate the presigned
// imageUrl. The hydration guard must refresh the image link alone — never a
// full form.reset that would wipe unsaved edits.
it('keeps unsaved edits and refreshes the image link when the signed-image rotation refetches the same service',async()=>{
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:oldImage}
  const {client,rerender}=renderForm(<ServiceFormPage mode="edit" serviceId="saved-service" />)
  await consultText()
  fireEvent.change(screen.getByLabelText('nameAr'),{target:{value:'تعديل مستخدم'}})
  // Simulates TanStack Query's background rotation refetch: fresh object
  // identity, same service id.
  const rotated='https://media.invalid/old-image?X-Amz-Signature=rotated'
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:rotated}
  rerender(<QueryClientProvider client={client}><ServiceFormPage mode="edit" serviceId="saved-service" /></QueryClientProvider>)
  await waitFor(()=>expect(screen.getByLabelText('image reference')).toHaveValue(rotated))
  expect(screen.getByLabelText('nameAr')).toHaveValue('تعديل مستخدم')
  fireEvent.click(screen.getByRole('button',{name:'services.edit.submit'}))
  await waitFor(()=>expect(state.push).toHaveBeenCalledWith('/services'))
  // The rotated URL equals the server's current image, so it stays "unchanged".
  expect(state.update).toHaveBeenCalledWith(expect.objectContaining({id:'saved-service',imageUrl:undefined}))
})

it('does not clobber a pending blob preview when the signed image rotates',async()=>{
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:oldImage}
  const {client,rerender}=renderForm(<ServiceFormPage mode="edit" serviceId="saved-service" />)
  await consultText()
  fireEvent.change(screen.getByLabelText('image file'),{target:{files:[new File(['replacement'],'service.png',{type:'image/png'})]}})
  const rotated='https://media.invalid/old-image?X-Amz-Signature=rotated'
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:rotated}
  rerender(<QueryClientProvider client={client}><ServiceFormPage mode="edit" serviceId="saved-service" /></QueryClientProvider>)
  await waitFor(()=>expect(screen.getByLabelText('nameAr')).toHaveValue('استشارة'))
  expect(screen.getByLabelText('image reference')).toHaveValue('blob:selected-service-image')
})

it('keeps an explicit image removal across a signed-image rotation',async()=>{
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:oldImage}
  const {client,rerender}=renderForm(<ServiceFormPage mode="edit" serviceId="saved-service" />)
  await consultText()
  fireEvent.click(screen.getByRole('button',{name:'Clear image'}))
  const rotated='https://media.invalid/old-image?X-Amz-Signature=rotated'
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:rotated}
  rerender(<QueryClientProvider client={client}><ServiceFormPage mode="edit" serviceId="saved-service" /></QueryClientProvider>)
  await waitFor(()=>expect(screen.getByLabelText('nameAr')).toHaveValue('استشارة'))
  expect(screen.getByLabelText('image reference')).toHaveValue('')
  fireEvent.click(screen.getByRole('button',{name:'services.edit.submit'}))
  await waitFor(()=>expect(state.push).toHaveBeenCalledWith('/services'))
  expect(state.update).toHaveBeenCalledWith(expect.objectContaining({id:'saved-service',imageUrl:null}))
})

it('seeds the open detail cache and invalidates list + packages after a successful image upload',async()=>{
  const updated={id:'service-uuid',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:'https://media.invalid/new-image?X-Amz-Signature=fresh'}
  state.record={id:'service-uuid',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:oldImage}
  state.upload.mockResolvedValue(updated)
  // Route param is a readable ref; the API still receives the UUID.
  const {client}=renderForm(<ServiceFormPage mode="edit" serviceId="SVC-12" />)
  const setQueryData=vi.spyOn(client,'setQueryData')
  const invalidate=vi.spyOn(client,'invalidateQueries')
  await consultText()
  const file=new File(['replacement'],'service.png',{type:'image/png'})
  fireEvent.change(screen.getByLabelText('image file'),{target:{files:[file]}})
  fireEvent.click(screen.getByRole('button',{name:'services.edit.submit'}))
  await waitFor(()=>expect(state.push).toHaveBeenCalledWith('/services'))
  expect(state.upload).toHaveBeenCalledWith('service-uuid',file)
  expect(state.update.mock.calls[0][0].imageUrl).toBeUndefined()
  expect(setQueryData).toHaveBeenCalledWith(['services','detail','SVC-12'],updated)
  expect(invalidate).toHaveBeenCalledWith({queryKey:['services'],refetchType:'all'})
  expect(invalidate).toHaveBeenCalledWith({queryKey:['packages'],refetchType:'all'})
  expect(state.push).toHaveBeenCalledTimes(1)
})

it('does not upload a file the user cleared after choosing it',async()=>{
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:oldImage}
  renderForm(<ServiceFormPage mode="edit" serviceId="saved-service" />)
  await consultText()
  fireEvent.change(screen.getByLabelText('image file'),{target:{files:[new File(['replacement'],'service.png',{type:'image/png'})]}})
  fireEvent.click(screen.getByRole('button',{name:'Clear image'}))
  fireEvent.click(screen.getByRole('button',{name:'services.edit.submit'}))
  await waitFor(()=>expect(state.push).toHaveBeenCalledWith('/services'))
  expect(state.upload).not.toHaveBeenCalled()
  expect(state.update.mock.calls[0][0].imageUrl).toBeNull()
})

it('does not upload a file the user replaced with an icon after choosing it',async()=>{
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:oldImage}
  renderForm(<ServiceFormPage mode="edit" serviceId="saved-service" />)
  await consultText()
  fireEvent.change(screen.getByLabelText('image file'),{target:{files:[new File(['replacement'],'service.png',{type:'image/png'})]}})
  fireEvent.click(screen.getByRole('button',{name:'Choose icon'}))
  fireEvent.click(screen.getByRole('button',{name:'services.edit.submit'}))
  await waitFor(()=>expect(state.push).toHaveBeenCalledWith('/services'))
  expect(state.upload).not.toHaveBeenCalled()
  expect(state.update.mock.calls[0][0]).toEqual(expect.objectContaining({imageUrl:null,iconName:'Clock01Icon'}))
})

it('preserves the stored image when replacing a service file fails after the general edit',async()=>{
  let storedImage:string|null=oldImage
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:oldImage}
  state.update.mockImplementation(async (payload:{imageUrl?:string|null})=>{if(payload.imageUrl!==undefined)storedImage=payload.imageUrl;return {}})
  state.upload.mockRejectedValueOnce(new Error('image upload failed'))
  const {client}=renderForm(<ServiceFormPage mode="edit" serviceId="saved-service" />)
  const setQueryData=vi.spyOn(client,'setQueryData')
  const invalidate=vi.spyOn(client,'invalidateQueries')
  await consultText()
  const file=new File(['replacement'],'service.png',{type:'image/png'})
  fireEvent.change(screen.getByLabelText('image file'),{target:{files:[file]}})
  fireEvent.click(screen.getByRole('button',{name:'services.edit.submit'}))
  await waitFor(()=>expect(state.error).toHaveBeenCalledTimes(1))
  expect(state.upload).toHaveBeenCalledWith('saved-service',file)
  expect(state.update.mock.calls[0][0].imageUrl).toBeUndefined()
  expect(JSON.parse(JSON.stringify(state.update.mock.calls[0][0]))).not.toHaveProperty('imageUrl')
  expect(storedImage).toBe(oldImage)
  expect(state.push).not.toHaveBeenCalled()
  expect(setQueryData).not.toHaveBeenCalled()
  expect(invalidate).not.toHaveBeenCalled()
})
it('omits a local blob preview even when no file is pending',async()=>{
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:oldImage}
  renderForm(<ServiceFormPage mode="edit" serviceId="saved-service" />)
  await consultText()
  fireEvent.change(screen.getByLabelText('image reference'),{target:{value:'blob:preview-without-file'}})
  fireEvent.click(screen.getByRole('button',{name:'services.edit.submit'}))
  await waitFor(()=>expect(state.push).toHaveBeenCalledWith('/services'))
  expect(state.update.mock.calls[0][0].imageUrl).toBeUndefined()
  expect(state.upload).not.toHaveBeenCalled()
})
it('still sends null for an explicit image removal',async()=>{
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:oldImage}
  renderForm(<ServiceFormPage mode="edit" serviceId="saved-service" />)
  await consultText()
  fireEvent.click(screen.getByRole('button',{name:'Clear image'}))
  fireEvent.click(screen.getByRole('button',{name:'services.edit.submit'}))
  await waitFor(()=>expect(state.push).toHaveBeenCalledWith('/services'))
  expect(state.update.mock.calls[0][0].imageUrl).toBeNull()
})
