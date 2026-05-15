import 'reflect-metadata';
import { ListCategoriesDto } from './list-categories.dto';

describe('ListCategoriesDto', () => {
  it('should be defined', () => {
    const dto = new ListCategoriesDto();
    expect(dto).toBeDefined();
  });
});
