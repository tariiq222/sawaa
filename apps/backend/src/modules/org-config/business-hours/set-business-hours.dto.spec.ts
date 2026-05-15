import 'reflect-metadata';
import { BusinessHourSlotDto } from './set-business-hours.dto';

describe('BusinessHourSlotDto', () => {
  it('should be defined', () => {
    const dto = new BusinessHourSlotDto();
    expect(dto).toBeDefined();
  });
});
