import 'reflect-metadata';
import { ListEmployeesDto } from './list-employees.dto';

describe('ListEmployeesDto', () => {
  it('should be defined', () => {
    const dto = new ListEmployeesDto();
    expect(dto).toBeDefined();
  });
});
