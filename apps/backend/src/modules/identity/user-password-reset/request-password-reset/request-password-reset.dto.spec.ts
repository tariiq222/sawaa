import 'reflect-metadata';
import { RequestPasswordResetDto } from './request-password-reset.dto';

describe('RequestPasswordResetDto', () => {
  it('should be defined', () => {
    const dto = new RequestPasswordResetDto();
    expect(dto).toBeDefined();
  });
});
