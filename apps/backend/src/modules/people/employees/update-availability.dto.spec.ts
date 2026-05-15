import 'reflect-metadata';
import { AvailabilityWindow } from './update-availability.dto';

describe('AvailabilityWindow', () => {
  it('should be defined', () => {
    const dto = new AvailabilityWindow();
    expect(dto).toBeDefined();
  });
});
