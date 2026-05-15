import 'reflect-metadata';
import { CreateEmployeeExceptionDto } from './create-employee-exception.dto';

describe('CreateEmployeeExceptionDto', () => {
  it('should be defined', () => {
    const dto = new CreateEmployeeExceptionDto();
    expect(dto).toBeDefined();
  });
});
