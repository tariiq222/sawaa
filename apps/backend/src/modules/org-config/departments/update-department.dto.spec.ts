import 'reflect-metadata';
import { UpdateDepartmentDto } from './update-department.dto';

describe('UpdateDepartmentDto', () => {
  it('should be defined', () => {
    const dto = new UpdateDepartmentDto();
    expect(dto).toBeDefined();
  });
});
