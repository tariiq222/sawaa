import { CheckAvailabilityDto } from './check-availability.dto';

describe('CheckAvailabilityDto', () => {
  it('should instantiate', () => {
    const dto = new CheckAvailabilityDto();
    expect(dto).toBeDefined();
  });
});
