import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
const {postForm} = vi.hoisted(()=>({postForm:vi.fn()}))
vi.mock('@/lib/api',()=>({api:{postForm}}))
vi.mock('@/components/locale-provider',()=>({useLocale:()=>({t:(key:string)=>key})}))
import { PackageFamilyImageField } from '@/components/features/packages/package-family-image-field'
function Field({onChange}:{onChange:(value:string|null)=>void}) {
  const [value,setValue]=useState<string|null>(null)
  const [busy,setBusy]=useState(false)
  return <><PackageFamilyImageField value={value} onChange={next=>{onChange(next);setValue(next)}} busy={busy} onBusyChange={setBusy}/><button disabled={busy}>Save</button></>
}
beforeEach(()=>{vi.clearAllMocks();URL.createObjectURL=vi.fn(()=> 'blob:local-image');URL.revokeObjectURL=vi.fn()})
it('uploads a file, disables saving until done and persists only the storage key',async()=>{
  let resolve!: (value:unknown)=>void
  postForm.mockReturnValue(new Promise(r=>{resolve=r}))
  const change=vi.fn()
  render(<Field onChange={change}/>)
  const file=new File(['image'],'clinic.png',{type:'image/png'})
  fireEvent.change(screen.getByLabelText('catalog.familyImage'),{target:{files:[file]}})
  expect(screen.getByRole('button',{name:'Save'})).toBeDisabled()
  expect(postForm.mock.calls[0][1].get('file')).toBe(file)
  resolve({storageKey:'objects/clinic.png',url:'https://minio/image?signature=expires'})
  await waitFor(()=>expect(change).toHaveBeenCalledWith('objects/clinic.png'))
  expect(screen.getByRole('img')).toHaveAttribute('src','blob:local-image')
  expect(screen.getByRole('button',{name:'Save'})).toBeEnabled()
  fireEvent.click(screen.getByRole('button',{name:'catalog.imageRemove'}))
  expect(change).toHaveBeenLastCalledWith(null)
})
