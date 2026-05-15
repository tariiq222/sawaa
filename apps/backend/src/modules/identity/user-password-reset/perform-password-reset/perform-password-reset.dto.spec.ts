import 'reflect-metadata';
import { PerformPasswordResetDto } from './perform-password-reset.dto';

describe('PerformPasswordResetDto', () => {
  it('should be defined', () => {
    const dto = new PerformPasswordResetDto();
    expect(dto).toBeDefined();
  });
});
