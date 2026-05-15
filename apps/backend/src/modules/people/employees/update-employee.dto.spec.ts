import 'reflect-metadata';
import { UpdateEmployeeDto } from './update-employee.dto';

describe('UpdateEmployeeDto', () => {
  it('should be defined', () => {
    const dto = new UpdateEmployeeDto();
    expect(dto).toBeDefined();
  });
});
