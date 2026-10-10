import { beforeEach, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({fetch:vi.fn(),assign:vi.fn(),remove:vi.fn(),update:vi.fn()}))
vi.mock('@/lib/api/services',()=>({fetchServiceEmployees:mocks.fetch}))
vi.mock('@/lib/api/employees-schedule',()=>({assignService:mocks.assign,removeEmployeeService:mocks.remove,updateEmployeeService:mocks.update}))
import { saveCreatedServiceEmployees } from '@/lib/service-creation'
beforeEach(()=>vi.clearAllMocks())
it('does not reassign a practitioner persisted before another step failed and applies changed active state',async()=>{
  mocks.fetch.mockResolvedValue([{employee:{id:'existing'}}])
  await saveCreatedServiceEmployees('service',['existing','new'],{existing:true,new:false})
  expect(mocks.assign).toHaveBeenCalledTimes(1)
  expect(mocks.assign).toHaveBeenCalledWith('new',{serviceId:'service'})
  expect(mocks.update).toHaveBeenCalledWith('existing','service',{isActive:true})
  expect(mocks.update).toHaveBeenCalledWith('new','service',{isActive:false})
})
it('removes persisted partial assignments the user deselected on retry',async()=>{
  mocks.fetch.mockResolvedValue([{employee:{id:'removed'}}])
  await saveCreatedServiceEmployees('service',[],{})
  expect(mocks.remove).toHaveBeenCalledWith('removed','service')
  expect(mocks.assign).not.toHaveBeenCalled()
})
