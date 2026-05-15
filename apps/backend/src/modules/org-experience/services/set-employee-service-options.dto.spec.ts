import 'reflect-metadata';
import { EmployeeServiceOptionInputDto } from './set-employee-service-options.dto';

describe('EmployeeServiceOptionInputDto', () => {
  it('should be defined', () => {
    const dto = new EmployeeServiceOptionInputDto();
    expect(dto).toBeDefined();
  });
});
