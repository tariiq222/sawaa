import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTable } from '@/components/features/data-table'
import { getContactMessageColumns } from '@/components/features/contact-messages/contact-message-columns'
const {mutate, errorToast} = vi.hoisted(()=>({mutate:vi.fn(),errorToast:vi.fn()}))
vi.mock('sonner',()=>({toast:{error:errorToast,success:vi.fn()}}))
vi.mock('@/hooks/use-contact-messages',()=>({useContactMessages:()=>({data:{items:[{id:'m1',name:'سارة',phone:null,email:null,body:'رسالة',status:'NEW',createdAt:'2026-10-01'}],meta:{total:1,page:1,totalPages:1}},isLoading:false}),useUpdateContactMessageStatus:()=>({mutate})}))
import { ContactMessagesTable } from '@/components/features/contact-messages/contact-messages-table'
vi.mock('@/components/locale-provider',()=>({useLocale:()=>({locale:'ar',t:(k:string)=>k})}))
describe('contact message full reading',()=>{
 it('reports rejected status changes to staff',()=>{
  mutate.mockImplementation((_input,callbacks)=>callbacks.onError(new Error('failed')))
  render(<ContactMessagesTable />)
  fireEvent.click(screen.getByRole('button',{name:'contactMessages.actions.markRead'}))
  expect(errorToast).toHaveBeenCalledWith('auditOperations.saveError')
 })
 it('lets staff expand the full body and preserves both contact methods',()=>{
  render(<DataTable columns={getContactMessageColumns({locale:'ar',t:k=>k,onUpdate:vi.fn()})} data={[{id:'m1',name:'سارة',phone:'0500000000',email:'test@example.test',body:'رسالة طويلة كاملة للنقاش',status:'NEW',createdAt:'2026-10-01'}] as never} />)
  expect(screen.getByText('0500000000')).toBeVisible()
  fireEvent.click(screen.getByText('auditOperations.readMessage'))
  expect(screen.getByText('رسالة طويلة كاملة للنقاش')).toBeVisible()
 })
})
