import 'reflect-metadata';
import { ListRatingsDto } from './list-ratings.dto';

describe('ListRatingsDto', () => {
  it('should be defined', () => {
    const dto = new ListRatingsDto();
    expect(dto).toBeDefined();
  });
});
