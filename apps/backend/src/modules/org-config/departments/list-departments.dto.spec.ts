import 'reflect-metadata';
import { ListDepartmentsDto } from './list-departments.dto';

describe('ListDepartmentsDto', () => {
  it('should be defined', () => {
    const dto = new ListDepartmentsDto();
    expect(dto).toBeDefined();
  });
});
