import 'reflect-metadata';
import { RegisterMobileUserDto } from './register-mobile-user.dto';

describe('RegisterMobileUserDto', () => {
  it('should be defined', () => {
    const dto = new RegisterMobileUserDto();
    expect(dto).toBeDefined();
  });
});
