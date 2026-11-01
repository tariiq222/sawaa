import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useForm } from 'react-hook-form'
import type { CreateServiceFormData } from '@/components/features/services/create/form-schema'
const calls=vi.hoisted(()=>({imageSelect:vi.fn(),imageClear:vi.fn()}))
vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}})
vi.mock('@/components/locale-provider',()=>({useLocale:()=>({locale:'en',t:(key:string)=>key})}))
vi.mock('@/hooks/use-service-form-categories',()=>({useServiceFormCategories:()=>({data:[],isLoading:false,isError:false})}))
vi.mock('@/hooks/use-departments',()=>({useDepartmentOptions:()=>({options:[]})}))
// The picker is the only piece stubbed: its callbacks are the real trigger
// points we care about, while BasicInfoTab itself stays real.
vi.mock('@/components/features/shared/service-avatar-picker',()=>({ServiceAvatarPicker:({onIconChange,onImageChange,onClear}:{iconName?:string|null;iconBgColor?:string|null;imageUrl?:string|null;serviceName?:string;onIconChange:(name:string,color:string)=>void;onImageChange:(file:File)=>void;onClear:()=>void})=><>
  <input type="file" aria-label="avatar file" onChange={event=>{const file=event.target.files?.[0];if(file)onImageChange(file)}} />
  <button type="button" onClick={()=>onIconChange('Clock01Icon','#123456')}>choose icon</button>
  <button type="button" onClick={onClear}>clear avatar</button>
</>}))
import { BasicInfoTab } from '@/components/features/services/create/basic-info-tab'
import { createServiceDefaults } from '@/components/features/services/create/form-schema'
function Harness(){
  const form=useForm<CreateServiceFormData>({defaultValues:createServiceDefaults})
  return <>
    <BasicInfoTab form={form} onImageSelect={calls.imageSelect} onImageClear={calls.imageClear} />
    <p data-testid="image-url">{String(form.watch('imageUrl'))}</p>
    <p data-testid="icon-name">{String(form.watch('iconName'))}</p>
    <p data-testid="icon-color">{String(form.watch('iconBgColor'))}</p>
  </>
}
afterEach(cleanup)
beforeEach(()=>{vi.clearAllMocks();URL.createObjectURL=vi.fn(()=> 'blob:local-avatar')})
it('registers a chosen file and clears the pending file when the avatar is removed',()=>{
  render(<Harness />)
  const file=new File(['image'],'service.png',{type:'image/png'})
  fireEvent.change(screen.getByLabelText('avatar file'),{target:{files:[file]}})
  expect(calls.imageSelect).toHaveBeenCalledWith(file)
  expect(screen.getByTestId('image-url')).toHaveTextContent('blob:local-avatar')
  expect(calls.imageClear).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'clear avatar'}))
  expect(calls.imageClear).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId('image-url')).toHaveTextContent('null')
})
it('clears the pending file when the avatar is replaced by an icon',()=>{
  render(<Harness />)
  fireEvent.change(screen.getByLabelText('avatar file'),{target:{files:[new File(['image'],'service.png',{type:'image/png'})]}})
  fireEvent.click(screen.getByRole('button',{name:'choose icon'}))
  expect(calls.imageClear).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId('image-url')).toHaveTextContent('null')
  expect(screen.getByTestId('icon-name')).toHaveTextContent('Clock01Icon')
  expect(screen.getByTestId('icon-color')).toHaveTextContent('#123456')
})
