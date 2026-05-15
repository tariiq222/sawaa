import 'reflect-metadata';
import { CreateEmployeeDto } from './create-employee.dto';

describe('CreateEmployeeDto', () => {
  it('should be defined', () => {
    const dto = new CreateEmployeeDto();
    expect(dto).toBeDefined();
  });
});
