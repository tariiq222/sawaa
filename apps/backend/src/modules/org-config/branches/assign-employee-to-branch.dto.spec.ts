import 'reflect-metadata';
import { AssignEmployeeToBranchDto } from './assign-employee-to-branch.dto';

describe('AssignEmployeeToBranchDto', () => {
  it('should be defined', () => {
    const dto = new AssignEmployeeToBranchDto();
    expect(dto).toBeDefined();
  });
});
