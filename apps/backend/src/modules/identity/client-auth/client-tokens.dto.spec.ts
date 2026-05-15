import 'reflect-metadata';
import { RefreshTokenDto } from './client-tokens.dto';

describe('RefreshTokenDto', () => {
  it('should be defined', () => {
    const dto = new RefreshTokenDto();
    expect(dto).toBeDefined();
  });
});
