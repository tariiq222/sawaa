import 'reflect-metadata';
import { AssignPermissionsDto } from './assign-permissions.dto';

describe('AssignPermissionsDto', () => {
  it('should be defined', () => {
    const dto = new AssignPermissionsDto();
    expect(dto).toBeDefined();
  });
});
