import 'reflect-metadata';
import { CreateRoleDto } from './create-role.dto';

describe('CreateRoleDto', () => {
  it('should be defined', () => {
    const dto = new CreateRoleDto();
    expect(dto).toBeDefined();
  });
});
