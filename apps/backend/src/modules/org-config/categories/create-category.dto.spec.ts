import 'reflect-metadata';
import { CreateCategoryDto } from './create-category.dto';

describe('CreateCategoryDto', () => {
  it('should be defined', () => {
    const dto = new CreateCategoryDto();
    expect(dto).toBeDefined();
  });
});
