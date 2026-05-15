import 'reflect-metadata';
import { EmployeeOnboardingProfileDto } from './employee-onboarding.dto';

describe('EmployeeOnboardingProfileDto', () => {
  it('should be defined', () => {
    const dto = new EmployeeOnboardingProfileDto();
    expect(dto).toBeDefined();
  });
});
