import 'reflect-metadata';
import { RefreshTokenDto } from './refresh-token.dto';

describe('RefreshTokenDto', () => {
  it('should be defined', () => {
    const dto = new RefreshTokenDto();
    expect(dto).toBeDefined();
  });
});
