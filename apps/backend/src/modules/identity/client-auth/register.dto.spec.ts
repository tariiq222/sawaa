import 'reflect-metadata';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('should be defined', () => {
    const dto = new RegisterDto();
    expect(dto).toBeDefined();
  });
});
