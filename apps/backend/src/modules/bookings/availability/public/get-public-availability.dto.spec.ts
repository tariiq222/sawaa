import 'reflect-metadata';
import { GetPublicAvailabilityDto } from './get-public-availability.dto';

describe('GetPublicAvailabilityDto', () => {
  it('should be defined', () => {
    const dto = new GetPublicAvailabilityDto();
    expect(dto).toBeDefined();
  });
});
