import 'reflect-metadata';
import { ResetPasswordDto } from './reset-password.dto';

describe('ResetPasswordDto', () => {
  it('should be defined', () => {
    const dto = new ResetPasswordDto();
    expect(dto).toBeDefined();
  });
});
