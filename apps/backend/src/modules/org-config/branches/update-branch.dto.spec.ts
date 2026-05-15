import 'reflect-metadata';
import { UpdateBranchDto } from './update-branch.dto';

describe('UpdateBranchDto', () => {
  it('should be defined', () => {
    const dto = new UpdateBranchDto();
    expect(dto).toBeDefined();
  });
});
