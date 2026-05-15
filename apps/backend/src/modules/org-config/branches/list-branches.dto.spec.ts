import 'reflect-metadata';
import { ListBranchesDto } from './list-branches.dto';

describe('ListBranchesDto', () => {
  it('should be defined', () => {
    const dto = new ListBranchesDto();
    expect(dto).toBeDefined();
  });
});
