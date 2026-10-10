import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
const fetchConversations=vi.hoisted(()=>vi.fn(async()=>({data:[],meta:{hasMore:false,nextCursor:null}})))
vi.mock('@/lib/api/conversations',()=>({fetchConversations,fetchConversation:vi.fn(),fetchConversationMessages:vi.fn()}))
import {useConversations} from '@/hooks/use-conversations'
it('debounces inbox search while retaining the latest value',async()=>{
 const qc=new QueryClient({defaultOptions:{queries:{retry:false}}})
 const wrapper=({children}:React.PropsWithChildren)=><QueryClientProvider client={qc}>{children}</QueryClientProvider>
 const {rerender,unmount}=renderHook(({search})=>useConversations({search}),{wrapper,initialProps:{search:''}})
 await waitFor(()=>expect(fetchConversations).toHaveBeenCalledTimes(1))
 vi.useFakeTimers()
 try {
  rerender({search:'س'})
  rerender({search:'سارة'})
  expect(fetchConversations).toHaveBeenCalledTimes(1)
  await act(async()=>{await vi.advanceTimersByTimeAsync(300)})
  expect(fetchConversations).toHaveBeenLastCalledWith(expect.objectContaining({search:'سارة'}))
 } finally {unmount();vi.useRealTimers();qc.clear()}
})
