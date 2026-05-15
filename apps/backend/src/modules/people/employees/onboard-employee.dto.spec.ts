import 'reflect-metadata';
import { OnboardEmployeeDto } from './onboard-employee.dto';

describe('OnboardEmployeeDto', () => {
  it('should be defined', () => {
    const dto = new OnboardEmployeeDto();
    expect(dto).toBeDefined();
  });
});
