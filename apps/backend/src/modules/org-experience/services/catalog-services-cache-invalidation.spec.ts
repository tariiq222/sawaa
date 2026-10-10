import { AssignEmployeeServiceHandler } from '../../people/employees/assign-employee-service.handler';
import { RemoveEmployeeServiceHandler } from '../../people/employees/remove-employee-service.handler';
import { UpdateEmployeeServiceHandler } from '../../people/employees/update-employee-service.handler';
import { UpdateEmployeeHandler } from '../../people/employees/update-employee.handler';
import { CreateEmployeeHandler } from '../../people/employees/create-employee.handler';
import { EmployeeOnboardingHandler } from '../../people/employees/employee-onboarding.handler';
import { AssignEmployeeToBranchHandler } from '../../org-config/branches/assign-employee-to-branch.handler';
import { UnassignEmployeeFromBranchHandler } from '../../org-config/branches/unassign-employee-from-branch.handler';
import { SERVICES_CACHE_PREFIX } from './services.cache';

function fixture() {
  const employee = {id:'employee',isActive:true,onboardingStatus:'IN_PROGRESS',userId:null};
  const db = {
    employee:{findFirst:jest.fn().mockResolvedValue(employee),findUnique:jest.fn().mockResolvedValue(employee),create:jest.fn().mockResolvedValue(employee),update:jest.fn().mockResolvedValue(employee)},
    service:{findFirst:jest.fn().mockResolvedValue({id:'service'})},
    branch:{findFirst:jest.fn().mockResolvedValue({id:'branch'})},
    employeeService:{findUnique:jest.fn().mockResolvedValue({id:'link'}),create:jest.fn(),update:jest.fn(),delete:jest.fn(),deleteMany:jest.fn(),createMany:jest.fn()},
    employeeBranch:{findFirst:jest.fn().mockResolvedValue({id:'branch-link'}),create:jest.fn(),delete:jest.fn(),deleteMany:jest.fn(),createMany:jest.fn()},
    employeeServiceOption:{deleteMany:jest.fn()},serviceDurationOption:{deleteMany:jest.fn()},
  };
  const rls = {withTransaction:jest.fn(async fn=>fn(db))};
  const events = {publish:jest.fn().mockResolvedValue(undefined)};
  const cache = {invalidatePrefix:jest.fn().mockResolvedValue(undefined)};
  return {db,rls,events,cache};
}

describe('catalog service-list cache dependencies',()=>{
  it.each(['assign service','remove service','toggle service','toggle employee','create employee','onboard branches','onboard services','assign branch','remove branch'])('invalidates cached branch lists after %s',async action=>{
    const {db,rls,events,cache}=fixture();
    switch(action) {
      case 'assign service': db.employeeService.findUnique.mockResolvedValue(null); await new (AssignEmployeeServiceHandler as any)(db,cache).execute({employeeId:'employee',serviceId:'service'}); break;
      case 'remove service': await new (RemoveEmployeeServiceHandler as any)(db,rls,cache).execute({employeeId:'employee',serviceId:'service'}); break;
      case 'toggle service': await new (UpdateEmployeeServiceHandler as any)(db,cache).execute({employeeId:'employee',serviceId:'service',isActive:false}); break;
      case 'toggle employee': await new (UpdateEmployeeHandler as any)(db,rls,events,{},cache).execute({employeeId:'employee',isActive:false}); break;
      case 'create employee': await new (CreateEmployeeHandler as any)(db,rls,events,cache).execute({name:'New',branchIds:['branch'],serviceIds:['service']}); break;
      case 'onboard branches': await new (EmployeeOnboardingHandler as any)(db,rls,cache).execute({employeeId:'employee',step:'branches',branchIds:['branch']}); break;
      case 'onboard services': await new (EmployeeOnboardingHandler as any)(db,rls,cache).execute({employeeId:'employee',step:'services',serviceIds:['service']}); break;
      case 'assign branch': await new (AssignEmployeeToBranchHandler as any)(db,cache).execute({employeeId:'employee',branchId:'branch'}); break;
      case 'remove branch': await new (UnassignEmployeeFromBranchHandler as any)(db,cache).execute({employeeId:'employee',branchId:'branch'}); break;
    }
    expect(cache.invalidatePrefix).toHaveBeenCalledWith(SERVICES_CACHE_PREFIX);
  });
  it('leaves the cache intact if the relation transaction fails',async()=>{
    const {db,rls,cache}=fixture();
    rls.withTransaction.mockRejectedValue(new Error('transaction failed'));
    await expect(new (EmployeeOnboardingHandler as any)(db,rls,cache).execute({employeeId:'employee',step:'branches',branchIds:[]})).rejects.toThrow('transaction failed');
    expect(cache.invalidatePrefix).not.toHaveBeenCalled();
  });
});
