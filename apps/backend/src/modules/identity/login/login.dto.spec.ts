import 'reflect-metadata';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('should be defined', () => {
    const dto = new LoginDto();
    expect(dto).toBeDefined();
  });
});
