import 'reflect-metadata';
import { AddHolidayDto } from './add-holiday.dto';

describe('AddHolidayDto', () => {
  it('should be defined', () => {
    const dto = new AddHolidayDto();
    expect(dto).toBeDefined();
  });
});
