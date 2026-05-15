import 'reflect-metadata';
import { CreateDepartmentDto } from './create-department.dto';

describe('CreateDepartmentDto', () => {
  it('should be defined', () => {
    const dto = new CreateDepartmentDto();
    expect(dto).toBeDefined();
  });
});
