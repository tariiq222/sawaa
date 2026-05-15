import 'reflect-metadata';
import { ListActivityDto } from './list-activity.dto';

describe('ListActivityDto', () => {
  it('should be defined', () => {
    const dto = new ListActivityDto();
    expect(dto).toBeDefined();
  });
});
