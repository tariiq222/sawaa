import 'reflect-metadata';
import { PaginationDto } from './pagination.dto';

describe('PaginationDto', () => {
  it('should be defined', () => {
    const dto = new PaginationDto();
    expect(dto).toBeDefined();
  });
});
