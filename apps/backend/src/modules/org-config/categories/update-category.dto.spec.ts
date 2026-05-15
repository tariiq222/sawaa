import 'reflect-metadata';
import { UpdateCategoryDto } from './update-category.dto';

describe('UpdateCategoryDto', () => {
  it('should be defined', () => {
    const dto = new UpdateCategoryDto();
    expect(dto).toBeDefined();
  });
});
