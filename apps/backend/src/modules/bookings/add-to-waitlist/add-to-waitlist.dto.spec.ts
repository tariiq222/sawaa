import 'reflect-metadata';
import { AddToWaitlistDto } from './add-to-waitlist.dto';

describe('AddToWaitlistDto', () => {
  it('should be defined', () => {
    const dto = new AddToWaitlistDto();
    expect(dto).toBeDefined();
  });
});
