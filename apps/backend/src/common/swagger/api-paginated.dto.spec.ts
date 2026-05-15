import 'reflect-metadata';
import { PaginationMetaDto } from './api-paginated.dto';

describe('PaginationMetaDto', () => {
  it('should be defined', () => {
    const dto = new PaginationMetaDto();
    expect(dto).toBeDefined();
  });
});
