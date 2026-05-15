import 'reflect-metadata';
import { ListWaitlistDto } from './list-waitlist.dto';

describe('ListWaitlistDto', () => {
  it('should be defined', () => {
    const dto = new ListWaitlistDto();
    expect(dto).toBeDefined();
  });
});
