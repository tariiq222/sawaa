import 'reflect-metadata';
import { GetTopPerformersDto } from './get-top-performers.dto';

describe('GetTopPerformersDto', () => {
  it('should be defined', () => {
    const dto = new GetTopPerformersDto();
    expect(dto).toBeDefined();
  });
});
