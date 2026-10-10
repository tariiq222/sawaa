import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
const changePage = vi.hoisted(()=>vi.fn())
vi.mock('@/components/locale-provider',()=>({useLocale:()=>({locale:'ar',t:(k:string)=>k})}))
vi.mock('@/hooks/use-activity-log',()=>({useActivityLogs:()=>({logs:Array.from({length:20},(_,i)=>({id:String(i), action:'created',module:'bookings',createdAt:'2026-10-01',user:null})),isLoading:false,error:null,meta:{total:45,totalPages:3,hasNextPage:true,hasPreviousPage:false},page:1,setPage:changePage,setModule:vi.fn(),setAction:vi.fn(),dateFrom:'',dateTo:'',setDateFrom:vi.fn(),setDateTo:vi.fn(),resetFilters:vi.fn(),refetch:vi.fn()})}))
import { ActivityLogTab } from '@/components/features/activity-log/activity-log-tab'
describe('activity browsing',()=>{
 it('renders all 20 server rows and advances the server page',()=>{
  render(<ActivityLogTab />)
  expect(screen.getAllByRole('row')).toHaveLength(21)
  fireEvent.click(screen.getByRole('button',{name:'table.next'}))
  expect(changePage).toHaveBeenCalledWith(2)
  expect(screen.queryByText('approved')).toBeNull()
  expect(screen.getAllByText('auditOperations.activityAction.created').length).toBeGreaterThan(0)
  expect(screen.getAllByText('auditOperations.activityModule.bookings').length).toBeGreaterThan(0)
 })
})
