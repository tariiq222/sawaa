import 'reflect-metadata';
import { CreateBranchDto } from './create-branch.dto';

describe('CreateBranchDto', () => {
  it('should be defined', () => {
    const dto = new CreateBranchDto();
    expect(dto).toBeDefined();
  });
});
