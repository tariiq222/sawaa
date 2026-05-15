import 'reflect-metadata';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  it('should be defined', () => {
    const dto = new CreateUserDto();
    expect(dto).toBeDefined();
  });
});
