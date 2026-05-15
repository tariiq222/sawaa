import 'reflect-metadata';
import { ListHolidaysDto } from './list-holidays.dto';

describe('ListHolidaysDto', () => {
  it('should be defined', () => {
    const dto = new ListHolidaysDto();
    expect(dto).toBeDefined();
  });
});
