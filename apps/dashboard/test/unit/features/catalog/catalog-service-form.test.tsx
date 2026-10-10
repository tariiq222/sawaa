import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { UseFormReturn } from 'react-hook-form'
import type { CreateServiceFormData } from '@/components/features/services/create/form-schema'
const state=vi.hoisted(()=>({record:undefined as unknown,create:vi.fn(),update:vi.fn(),booking:vi.fn(),employees:vi.fn(),error:vi.fn(),push:vi.fn(),upload:vi.fn()}))
vi.mock('next/navigation',()=>({useRouter:()=>({push:state.push}),useSearchParams:()=>new URLSearchParams()}))
vi.mock('@tanstack/react-query',()=>({useQuery:()=>({data:state.record,isLoading:false,isError:false})}))
vi.mock('@/components/locale-provider',()=>({useLocale:()=>({locale:'en',t:(key:string)=>key})}))
vi.mock('@/lib/mutation-helpers',()=>({showApiError:state.error}))
vi.mock('@/hooks/use-services',()=>({useServiceMutations:()=>({createMut:{mutateAsync:state.create},updateMut:{mutateAsync:state.update}}),useServiceBookingTypesMutation:()=>({mutateAsync:vi.fn()}),useServiceBookingTypes:()=>({data:undefined})}))
vi.mock('@/lib/api/services',()=>({fetchService:vi.fn(),uploadServiceImage:state.upload}))
vi.mock('@/lib/service-creation',()=>({saveCreatedServiceEmployees:state.employees}))
vi.mock('@/components/features/services/service-form-helpers',async importOriginal=>({...await importOriginal<object>(),saveBookingTypesApi:state.booking}))
vi.mock('@/components/features/services/use-service-create-category-context',()=>({useServiceCreateCategoryContext:()=>({categories:[],context:null,validCategory:null})}))
vi.mock('@/components/features/services/service-form-page-header',()=>({ServiceFormPageHeader:()=>null}))
vi.mock('@/components/features/services/create/basic-info-tab',()=>({BasicInfoTab:({form,onImageSelect}:{form:UseFormReturn<CreateServiceFormData>;onImageSelect:(file:File)=>void})=><><input aria-label="nameAr" {...form.register('nameAr')} /><input aria-label="nameEn" {...form.register('nameEn')} /><input aria-label="categoryId" {...form.register('categoryId')} /><input aria-label="image reference" {...form.register('imageUrl')} /><input type="file" aria-label="image file" onChange={event=>{const file=event.target.files?.[0];if(file){form.setValue('imageUrl','blob:selected-service-image');onImageSelect(file)}}} /><button type="button" onClick={()=>form.setValue('imageUrl',null)}>Clear image</button></>}))
vi.mock('@/components/features/services/create/pricing-tab',()=>({PricingTab:()=>null}))
vi.mock('@/components/features/services/create/booking-settings-tab',()=>({BookingSettingsTab:()=>null}))
vi.mock('@/components/features/services/service-employees-tab',()=>({ServiceEmployeesTab:()=>null}))
import { ServiceFormPage } from '@/components/features/services/service-form-page'
const categoryId='550e8400-e29b-41d4-a716-446655440000'
afterEach(cleanup)
beforeEach(()=>{vi.clearAllMocks();state.record=undefined;state.create.mockResolvedValue({id:'created-service'});state.update.mockResolvedValue({});state.booking.mockResolvedValue(undefined);state.employees.mockResolvedValue(undefined);state.upload.mockResolvedValue(undefined)})
it('resumes the actual multi-step create form after booking configuration fails and blocks a double submit',async()=>{
  state.booking.mockRejectedValueOnce(new Error('booking config failed'))
  render(<ServiceFormPage mode="create" />)
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
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:'https://media.invalid/image?X-Amz-Signature=temporary'}
  render(<ServiceFormPage mode="edit" serviceId="saved-service" />)
  await waitFor(()=>expect(screen.getByLabelText('nameAr')).toHaveValue('استشارة'))
  fireEvent.click(screen.getByRole('button',{name:'services.edit.submit'}))
  await waitFor(()=>expect(state.push).toHaveBeenCalledWith('/services'))
  expect(state.update).toHaveBeenCalledWith(expect.objectContaining({id:'saved-service',imageUrl:undefined}))
})

it('preserves the stored image when replacing a service file fails after the general edit',async()=>{
  const oldImage='objects/original-service.png'
  let storedImage:string|null=oldImage
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:'https://media.invalid/old-image?X-Amz-Signature=temporary'}
  state.update.mockImplementation(async (payload:{imageUrl?:string|null})=>{if(payload.imageUrl!==undefined)storedImage=payload.imageUrl;return {}})
  state.upload.mockRejectedValueOnce(new Error('image upload failed'))
  render(<ServiceFormPage mode="edit" serviceId="saved-service" />)
  await waitFor(()=>expect(screen.getByLabelText('nameAr')).toHaveValue('استشارة'))
  const file=new File(['replacement'],'service.png',{type:'image/png'})
  fireEvent.change(screen.getByLabelText('image file'),{target:{files:[file]}})
  fireEvent.click(screen.getByRole('button',{name:'services.edit.submit'}))
  await waitFor(()=>expect(state.error).toHaveBeenCalledTimes(1))
  expect(state.upload).toHaveBeenCalledWith('saved-service',file)
  expect(state.update.mock.calls[0][0].imageUrl).toBeUndefined()
  expect(JSON.parse(JSON.stringify(state.update.mock.calls[0][0]))).not.toHaveProperty('imageUrl')
  expect(storedImage).toBe(oldImage)
  expect(state.push).not.toHaveBeenCalled()
})
it('omits a local blob preview even when no file is pending',async()=>{
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:'https://media.invalid/old-image?X-Amz-Signature=temporary'}
  render(<ServiceFormPage mode="edit" serviceId="saved-service" />)
  await waitFor(()=>expect(screen.getByLabelText('nameAr')).toHaveValue('استشارة'))
  fireEvent.change(screen.getByLabelText('image reference'),{target:{value:'blob:preview-without-file'}})
  fireEvent.click(screen.getByRole('button',{name:'services.edit.submit'}))
  await waitFor(()=>expect(state.push).toHaveBeenCalledWith('/services'))
  expect(state.update.mock.calls[0][0].imageUrl).toBeUndefined()
  expect(state.upload).not.toHaveBeenCalled()
})
it('still sends null for an explicit image removal',async()=>{
  state.record={id:'saved-service',nameAr:'استشارة',nameEn:'Consultation',categoryId,isActive:true,imageUrl:'https://media.invalid/old-image?X-Amz-Signature=temporary'}
  render(<ServiceFormPage mode="edit" serviceId="saved-service" />)
  await waitFor(()=>expect(screen.getByLabelText('nameAr')).toHaveValue('استشارة'))
  fireEvent.click(screen.getByRole('button',{name:'Clear image'}))
  fireEvent.click(screen.getByRole('button',{name:'services.edit.submit'}))
  await waitFor(()=>expect(state.push).toHaveBeenCalledWith('/services'))
  expect(state.update.mock.calls[0][0].imageUrl).toBeNull()
})
